import { beforeEach, describe, expect, it } from 'vitest'
import type { Log, PublicClient } from 'viem'
import { DEFAULT_STEPS, learnedRangeStep, resetLogScanState, scanLogs } from './logscan'

// A fake provider: head at `tip`, a hard cap on blocks per request (like Reth's default of 100,000
// or a hosted provider's 10,000), and one log at each block in `logBlocks`.
function provider(tip: bigint, cap: bigint, logBlocks: bigint[]) {
  const calls: Array<[bigint, bigint]> = []
  let inFlight = 0, maxInFlight = 0
  const pc = {
    getBlockNumber: async () => tip,
    getLogs: async (a: { fromBlock: bigint; toBlock: bigint }) => {
      calls.push([a.fromBlock, a.toBlock])
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, 1))
      inFlight--
      if (a.toBlock - a.fromBlock + 1n > cap) throw new Error('query exceeds max block range')
      return logBlocks.filter(b => b >= a.fromBlock && b <= a.toBlock).map(b => ({ blockNumber: b, topics: [], data: '0x' }) as unknown as Log)
    },
  } as unknown as PublicClient
  return { pc, calls, maxInFlight: () => maxInFlight, setTip: (t: bigint) => { tip = t }, addLog: (b: bigint) => logBlocks.push(b) }
}
const START = 27_766_000n
const args = { address: '0x0000000000000000000000000000000000000001', event: { name: 'ListingCreated' } }

beforeEach(() => resetLogScanState())

describe('scanLogs', () => {
  it('reads the whole history through a provider that caps the block range', async () => {
    const p = provider(START + 1_600_000n, 100_000n, [START + 10n, START + 900_000n, START + 1_599_999n])
    const logs = await scanLogs(p.pc, args, { from: START })
    expect(logs).toHaveLength(3)
    expect(p.calls.length).toBeLessThanOrEqual(20) // 17 chunks of 100k, plus one rejected probe
    expect(p.maxInFlight()).toBeGreaterThan(1) // not strictly sequential
    expect(learnedRangeStep()).toBe(100_000n)
  })

  it('falls back to smaller ranges for a 10,000-block provider and remembers the size', async () => {
    const p = provider(START + 200_000n, 10_000n, [START + 5n, START + 199_000n])
    expect(await scanLogs(p.pc, args, { from: START })).toHaveLength(2)
    expect(learnedRangeStep()).toBe(10_000n)
    const before = p.calls.length
    // A different query starts at the size that worked, not at 100,000 again.
    await scanLogs(p.pc, { ...args, event: { name: 'BidPlaced' } }, { from: START })
    expect(p.calls.slice(before).every(([f, t]) => t - f + 1n <= 10_000n)).toBe(true)
  })

  it('refreshes incrementally: only new blocks are requested and new logs appear', async () => {
    const p = provider(START + 300_000n, 100_000n, [START + 50n])
    expect(await scanLogs(p.pc, args, { from: START })).toHaveLength(1)
    const before = p.calls.length
    p.setTip(START + 300_040n); p.addLog(START + 300_030n) // a listing posted just now
    const logs = await scanLogs(p.pc, args, { from: START })
    expect(logs).toHaveLength(2)
    expect(p.calls.slice(before)).toEqual([[START + 300_001n, START + 300_040n]])
  })

  it('makes no log requests when nothing new was mined', async () => {
    const p = provider(START + 1_000n, 100_000n, [START + 1n])
    await scanLogs(p.pc, args, { from: START })
    const before = p.calls.length
    await scanLogs(p.pc, args, { from: START })
    expect(p.calls.length).toBe(before)
  })

  it('shares one scan between identical concurrent callers', async () => {
    const p = provider(START + 250_000n, 100_000n, [START + 7n])
    const [a, b, c] = await Promise.all([scanLogs(p.pc, args, { from: START }), scanLogs(p.pc, args, { from: START }), scanLogs(p.pc, args, { from: START })])
    expect(a).toBe(b); expect(b).toBe(c)
    expect(p.calls.length).toBe(3)
  })

  it('keeps separate caches for different filters', async () => {
    const p = provider(START + 100n, 100_000n, [START + 1n])
    await scanLogs(p.pc, { ...args, args: { jobId: 1n } }, { from: START })
    const before = p.calls.length
    await scanLogs(p.pc, { ...args, args: { jobId: 2n } }, { from: START })
    expect(p.calls.length).toBeGreaterThan(before)
  })

  it('throws when every range size is rejected', async () => {
    const p = provider(START + 10n, 0n, [])
    await expect(scanLogs(p.pc, args, { from: START })).rejects.toThrow()
    expect(DEFAULT_STEPS[0]).toBe(100_000n)
  })
})
