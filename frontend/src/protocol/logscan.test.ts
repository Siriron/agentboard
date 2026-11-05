import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeEventTopics, type Log, type PublicClient } from 'viem'
import { blockscoutBulk, DEFAULT_STEPS, learnedRangeStep, resetLogScanState, scanLogs, type BulkSource } from './logscan'

// A fake provider: head at `tip`, a hard cap on blocks per request (Arc's public gateway allows 30,000),
// and one log at each block in `logBlocks`.
function provider(tip: bigint, cap: bigint, logBlocks: bigint[], delayMs = 1) {
  const calls: Array<[bigint, bigint]> = []
  let inFlight = 0, maxInFlight = 0
  const mk = (b: bigint) => ({ blockNumber: b, logIndex: 0, topics: ['0xaa'], data: '0x', address: ADDR, transactionHash: '0x01' }) as unknown as Log
  const pc = {
    getBlockNumber: async () => tip,
    getLogs: async (a: { fromBlock: bigint; toBlock: bigint }) => {
      calls.push([a.fromBlock, a.toBlock])
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, delayMs))
      inFlight--
      if (a.toBlock - a.fromBlock + 1n > cap) throw new Error('requested range too large')
      return logBlocks.filter(b => b >= a.fromBlock && b <= a.toBlock).map(mk)
    },
  } as unknown as PublicClient
  return { pc, calls, maxInFlight: () => maxInFlight, setTip: (t: bigint) => { tip = t }, addLog: (b: bigint) => logBlocks.push(b) }
}
const START = 27_766_000n
const ADDR = '0x0000000000000000000000000000000000000001'
const EVENT = { type: 'event', name: 'ListingCreated', inputs: [{ name: 'listingId', type: 'uint256', indexed: true }] }
const args = { address: ADDR, event: { name: 'ListingCreated' } }
const blocks = (logs: Log[]) => logs.map(l => Number(l.blockNumber))

beforeEach(() => resetLogScanState())

describe('scanLogs (RPC path)', () => {
  it('reads the whole history through a provider that caps the block range', async () => {
    const p = provider(START + 1_700_000n, 30_000n, [START + 10n, START + 900_000n, START + 1_699_999n])
    const r = await scanLogs(p.pc, args, { from: START })
    expect(r.complete).toBe(true)
    expect(blocks(r.logs)).toEqual([START + 10n, START + 900_000n, START + 1_699_999n].map(Number)) // oldest first
    expect(learnedRangeStep()).toBe(30_000n)
    expect(p.calls.length).toBeLessThanOrEqual(70) // about 57 chunks of 30k, plus a few rejected probes
    expect(p.maxInFlight()).toBeGreaterThan(1)
    expect(p.maxInFlight()).toBeLessThanOrEqual(3) // the public gateway rate-limits bursts
  })

  it('falls back to smaller ranges for a 10,000-block provider and remembers the size', async () => {
    const p = provider(START + 200_000n, 10_000n, [START + 5n, START + 199_000n])
    expect((await scanLogs(p.pc, args, { from: START })).logs).toHaveLength(2)
    expect(learnedRangeStep()).toBe(10_000n)
    const before = p.calls.length
    await scanLogs(p.pc, { ...args, event: { name: 'BidPlaced' } }, { from: START })
    expect(p.calls.slice(before).every(([f, t]) => t - f + 1n <= 10_000n)).toBe(true)
  })

  it('scans newest blocks first and returns partial results when the budget runs out', async () => {
    const p = provider(START + 600_000n, 30_000n, [START + 1n, START + 599_000n], 15)
    const r = await scanLogs(p.pc, args, { from: START, budgetMs: 40 })
    expect(r.complete).toBe(false)
    expect(blocks(r.logs)).toContain(Number(START + 599_000n)) // the recent log arrived first
    expect(blocks(r.logs)).not.toContain(Number(START + 1n))
    // the scan keeps going in the background; asking again completes it from the cache
    const r2 = await scanLogs(p.pc, args, { from: START })
    expect(r2.complete).toBe(true)
    expect(blocks(r2.logs)).toEqual([Number(START + 1n), Number(START + 599_000n)])
  })

  it('refreshes incrementally: only new blocks are requested and new logs appear', async () => {
    const p = provider(START + 300_000n, 30_000n, [START + 50n])
    expect((await scanLogs(p.pc, args, { from: START })).logs).toHaveLength(1)
    const before = p.calls.length
    p.setTip(START + 300_040n); p.addLog(START + 300_030n)
    const r = await scanLogs(p.pc, args, { from: START })
    expect(r.logs).toHaveLength(2)
    expect(p.calls.slice(before)).toEqual([[START + 300_001n, START + 300_040n]])
  })

  it('makes no log requests when nothing new was mined', async () => {
    const p = provider(START + 1_000n, 30_000n, [START + 1n])
    await scanLogs(p.pc, args, { from: START })
    const before = p.calls.length
    await scanLogs(p.pc, args, { from: START })
    expect(p.calls.length).toBe(before)
  })

  it('shares one scan between identical concurrent callers', async () => {
    const p = provider(START + 50_000n, 30_000n, [START + 7n])
    const [a, b, c] = await Promise.all([scanLogs(p.pc, args, { from: START }), scanLogs(p.pc, args, { from: START }), scanLogs(p.pc, args, { from: START })])
    expect(a.logs).toBe(b.logs); expect(b.logs).toBe(c.logs)
    expect(p.calls.length).toBe(2)
  })

  it('keeps separate progress for different filters', async () => {
    const p = provider(START + 100n, 30_000n, [START + 1n])
    await scanLogs(p.pc, { ...args, args: { jobId: 1n } }, { from: START })
    const before = p.calls.length
    await scanLogs(p.pc, { ...args, args: { jobId: 2n } }, { from: START })
    expect(p.calls.length).toBeGreaterThan(before)
  })

  it('throws when every range size is rejected, and resumes after a failure', async () => {
    const p = provider(START + 10n, 0n, [])
    await expect(scanLogs(p.pc, args, { from: START })).rejects.toThrow()
    expect(DEFAULT_STEPS[0]).toBe(30_000n)
  })
})

describe('scanLogs (bulk source)', () => {
  const span = 1_700_000n
  const ev = { address: ADDR, event: EVENT }
  const topics = (encodeEventTopics as unknown as (p: unknown) => string[])({ abi: [EVENT], eventName: 'ListingCreated' })
  const logAt = (b: bigint) => ({ blockNumber: b, logIndex: 0, topics, data: '0x', address: ADDR, transactionHash: '0x01' }) as unknown as Log

  it('reads old history from the bulk source and only the tail through the RPC', async () => {
    const p = provider(START + span, 30_000n, [START + span - 100n])
    const bulk: BulkSource = vi.fn(async () => [logAt(START + 5n)])
    const r = await scanLogs(p.pc, ev, { from: START, bulk })
    expect(r.complete).toBe(true)
    expect(bulk).toHaveBeenCalledTimes(1)
    expect(p.calls.length).toBe(1) // the 2,000-block tail is one request
    expect(r.logs).toHaveLength(2)
  })

  it('falls back to the RPC scan when the bulk source fails', async () => {
    const p = provider(START + 200_000n, 30_000n, [START + 9n])
    const bulk: BulkSource = async () => { throw new Error('explorer 502') }
    const r = await scanLogs(p.pc, ev, { from: START, bulk })
    expect(r.complete).toBe(true)
    expect(blocks(r.logs)).toEqual([Number(START + 9n)])
  })
})

describe('blockscoutBulk', () => {
  const addr = '0xAbC0000000000000000000000000000000000001'
  const t0 = '0x' + '11'.repeat(32)
  const row = (n: number, over: Record<string, unknown> = {}) => ({ address: addr.toLowerCase(), blockNumber: '0x' + n.toString(16), logIndex: '0x0', data: '0x00', topics: [t0, null, null, null], transactionHash: '0x' + String(n).padStart(64, '0'), ...over })
  const respond = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 502, json: async () => body }) as unknown as Response)
  const q = { address: addr, topics: [t0] as Array<string | null>, from: 1n, to: 100n }

  it('parses logs, drops empty topic slots and sorts by position', async () => {
    const f = respond({ status: '1', message: 'OK', result: [row(30), row(10)] })
    const logs = await blockscoutBulk('https://explorer.example/', f as never)(q)
    expect(logs.map(l => Number(l.blockNumber))).toEqual([10, 30])
    expect(logs[0].topics).toEqual([t0])
  })

  it('treats "No logs found" as an empty result', async () => {
    const f = respond({ status: '0', message: 'No logs found', result: [] })
    expect(await blockscoutBulk('https://explorer.example', f as never)(q)).toEqual([])
  })

  it('rejects logs from another address, a wrong event, malformed hex or an unexpected body', async () => {
    for (const body of [
      { status: '1', result: [row(1, { address: '0x' + '9'.repeat(40) })] },
      { status: '1', result: [row(1, { topics: ['0x' + '22'.repeat(32)] })] },
      { status: '1', result: [row(1, { data: 'zz' })] },
      { status: '0', message: 'NOTOK', result: 'Rate limit' },
    ]) await expect(blockscoutBulk('https://explorer.example', respond(body) as never)(q)).rejects.toThrow()
    await expect(blockscoutBulk('https://explorer.example', respond({}, false) as never)(q)).rejects.toThrow()
  })

  it('follows a full page by continuing from the last block and drops duplicates', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => row(i + 1))
    const calls: string[] = []
    const f = (async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => (calls.length === 1 ? { status: '1', result: page1 } : { status: '1', result: [row(1000), row(1001)] }) } as unknown as Response
    }) as never
    const logs = await blockscoutBulk('https://explorer.example', f)({ ...q, to: 5000n })
    expect(logs).toHaveLength(1001)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('fromBlock=1000')
  })
})

describe('persistence', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('a reload resumes from saved progress instead of rescanning', async () => {
    const p = provider(START + 300_000n, 30_000n, [START + 50n, START + 250_000n])
    await scanLogs(p.pc, args, { from: START })
    expect(store.size).toBe(1)
    resetLogScanState() // simulates a page reload: memory is gone, localStorage stays
    const before = p.calls.length
    p.setTip(START + 300_010n)
    const r = await scanLogs(p.pc, args, { from: START })
    expect(blocks(r.logs)).toEqual([Number(START + 50n), Number(START + 250_000n)])
    expect(p.calls.slice(before)).toEqual([[START + 300_001n, START + 300_010n]])
  })

  it('ignores corrupt or mismatched saved data', async () => {
    const p = provider(START + 1_000n, 30_000n, [START + 3n])
    await scanLogs(p.pc, args, { from: START })
    for (const k of store.keys()) store.set(k, '{not json')
    resetLogScanState()
    const r = await scanLogs(p.pc, args, { from: START })
    expect(blocks(r.logs)).toEqual([Number(START + 3n)])
  })
})
