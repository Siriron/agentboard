// Event-history reader for the browser.
//
// Mainnet (v2) listings, bids and jobs live in contract events. Arc's public RPC gateway caps eth_getLogs at
// 30,000 blocks per request, rate-limits bursts, and the chain adds about 170,000 blocks a day, so reading the whole
// history from a browser with eth_getLogs alone costs dozens to hundreds of requests on a cold start.
//
// What this does instead:
//   1. Bulk source first. Old history comes from one explorer (Blockscout) query when a bulk source is given;
//      only the most recent blocks, which the explorer may not have indexed yet, go through the RPC.
//   2. RPC fallback with provider-sized ranges (30,000, then smaller), a few chunks in parallel, newest blocks first,
//      so recent listings appear after the first window instead of after the whole history.
//   3. Progress is kept per query (in memory and in localStorage). A refresh or a reload only asks for blocks after
//      the last one scanned, and an interrupted scan resumes where it stopped.
//   4. Callers can give a time budget: they get what is known so far (`complete: false`) while the scan continues
//      in the background, so a page never has to wait on the slowest request.
//   5. Identical scans started at the same time share one job.
import { encodeEventTopics, type Log, type PublicClient } from 'viem'

export type Topics = Array<string | null>
export interface BulkQuery { address: string; topics: Topics; from: bigint; to: bigint }
export type BulkSource = (q: BulkQuery) => Promise<Log[]>

export interface ScanOptions {
  from: bigint
  /** Range sizes to try, largest first. */
  steps?: bigint[]
  concurrency?: number
  bulk?: BulkSource | null
  /** Blocks near the tip that are always read through the RPC (the explorer may lag). */
  tail?: bigint
  /** Return what is known after this many ms; the scan keeps going in the background. */
  budgetMs?: number
}
export interface ScanResult { logs: Log[]; complete: boolean }

export const DEFAULT_STEPS: bigint[] = [30_000n, 10_000n, 2_000n, 500n]
const DEFAULT_CONCURRENCY = 3
const BULK_MIN_SPAN = 60_000n
const STORE_PREFIX = 'agentboard.logs.v1:'
const MAX_STORED_CHARS = 1_500_000

interface Entry { from: bigint; lo: bigint; hi: bigint; logs: Log[] } // scanned range is [lo, hi]; empty when lo > hi
const entries = new Map<string, Entry>()
const jobs = new Map<string, Promise<void>>()
let learnedStep: bigint | null = null

export const resetLogScanState = () => { entries.clear(); jobs.clear(); learnedStep = null }
export const learnedRangeStep = () => learnedStep

const replacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)
function keyOf(args: Record<string, unknown>, from: bigint) {
  const { event, ...rest } = args as { event?: { name?: string } } & Record<string, unknown>
  return JSON.stringify({ ...rest, event: event?.name, from }, replacer)
}
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }

// ── persistence (best effort: private mode, quota and corrupt data are all ignored) ──
function load(key: string, from: bigint): Entry | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_PREFIX + hash(key)) : null
    if (!raw) return null
    const j = JSON.parse(raw)
    if (j.k !== key || j.from !== String(from) || !Array.isArray(j.l)) return null
    const logs = j.l.map((x: [string, string, string, number, string[], string]) => ({ address: x[0], blockNumber: BigInt(x[1]), data: x[2], logIndex: x[3], topics: x[4], transactionHash: x[5], removed: false }) as unknown as Log)
    return { from, lo: BigInt(j.lo), hi: BigInt(j.hi), logs }
  } catch { return null }
}
const lastSave = new Map<string, number>()
function save(key: string, e: Entry, force = false) {
  try {
    if (typeof localStorage === 'undefined') return
    const now = Date.now()
    if (!force && now - (lastSave.get(key) ?? 0) < 1500) return
    lastSave.set(key, now)
    const s = JSON.stringify({ k: key, from: String(e.from), lo: String(e.lo), hi: String(e.hi), l: e.logs.map(l => [l.address, String(l.blockNumber), l.data, l.logIndex, l.topics, l.transactionHash]) })
    if (s.length <= MAX_STORED_CHARS) localStorage.setItem(STORE_PREFIX + hash(key), s)
  } catch { /* quota or privacy mode */ }
}

type GetLogs = (a: unknown) => Promise<Log[]>

async function fetchChunks(pc: PublicClient, args: Record<string, unknown>, from: bigint, to: bigint, step: bigint, concurrency: number): Promise<Log[]> {
  const ranges: Array<[bigint, bigint]> = []
  for (let f = from; f <= to; f += step) ranges.push([f, f + step - 1n > to ? to : f + step - 1n])
  const parts: Log[][] = new Array(ranges.length)
  let next = 0
  let failure: unknown
  const worker = async () => {
    while (failure === undefined) {
      const i = next++
      if (i >= ranges.length) return
      try { parts[i] = await (pc.getLogs as unknown as GetLogs)({ ...args, fromBlock: ranges[i][0], toBlock: ranges[i][1] }) }
      catch (e) { failure = e ?? new Error('getLogs failed') }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ranges.length) }, worker))
  if (failure !== undefined) throw failure
  return parts.flat()
}

/** Reads [from, to] through the RPC, shrinking the range size when the provider refuses it. */
async function fetchRange(pc: PublicClient, args: Record<string, unknown>, from: bigint, to: bigint, opts: ScanOptions): Promise<Log[]> {
  if (from > to) return []
  const steps = opts.steps ?? DEFAULT_STEPS
  const startIdx = learnedStep !== null ? Math.max(0, steps.findIndex(s => s <= learnedStep!)) : 0
  let lastError: unknown
  for (const step of steps.slice(startIdx)) {
    try {
      const logs = await fetchChunks(pc, args, from, to, step, opts.concurrency ?? DEFAULT_CONCURRENCY)
      if (to - from + 1n > step) learnedStep = step
      return logs
    } catch (e) { lastError = e }
  }
  throw lastError ?? new Error('getLogs failed')
}

const topicsOf = (args: Record<string, unknown>): Topics => {
  const ev = args.event as { name: string } | undefined
  if (!ev) return []
  try { return (encodeEventTopics as unknown as (p: unknown) => Topics)({ abi: [ev], eventName: ev.name, args: args.args }) } catch { return [] }
}
const matches = (l: Log, topics: Topics) => topics.every((t, i) => t === null || (l.topics[i] ?? '').toLowerCase() === t.toLowerCase())
const byPosition = (a: Log, b: Log) => (a.blockNumber === b.blockNumber ? Number(a.logIndex) - Number(b.logIndex) : BigInt(a.blockNumber ?? 0) < BigInt(b.blockNumber ?? 0) ? -1 : 1)

async function advance(pc: PublicClient, key: string, args: Record<string, unknown>, e: Entry, opts: ScanOptions) {
  // viem caches the block number for ~4s; a stale value would hide logs from a just-confirmed transaction.
  const latest = await pc.getBlockNumber({ cacheTime: 0 })
  const tail = opts.tail ?? 2_000n
  if (e.lo > e.hi) { // nothing scanned yet
    e.lo = latest + 1n; e.hi = latest
    const topics = topicsOf(args)
    if (opts.bulk && topics.length && latest - e.from > BULK_MIN_SPAN) {
      const upTo = latest - tail
      try {
        const logs = (await opts.bulk({ address: String(args.address), topics, from: e.from, to: upTo })).filter(l => matches(l, topics)).sort(byPosition)
        e.logs = logs; e.lo = e.from; e.hi = upTo
        save(key, e)
      } catch { /* bulk source unavailable: fall through to the RPC scan */ }
    }
  }
  if (e.hi < latest) { // newest blocks since the last scan (or the tail after a bulk read)
    const fresh = await fetchRange(pc, args, e.hi + 1n, latest, opts)
    e.logs = e.logs.concat(fresh); e.hi = latest
    save(key, e)
  }
  const step = learnedStep ?? (opts.steps ?? DEFAULT_STEPS)[0]
  const window = step * BigInt(opts.concurrency ?? DEFAULT_CONCURRENCY)
  while (e.lo > e.from) { // older blocks, one window at a time, newest first
    const start = e.lo - window > e.from ? e.lo - window : e.from
    const older = await fetchRange(pc, args, start, e.lo - 1n, opts)
    e.logs = older.concat(e.logs); e.lo = start
    save(key, e)
  }
  save(key, e, true)
}

const done = (e: Entry) => e.lo <= e.from && e.hi >= e.lo

/** All logs matching `args` from `opts.from` to the chain tip (or what is known when `budgetMs` runs out). */
export async function scanLogs(pc: PublicClient, args: Record<string, unknown>, opts: ScanOptions): Promise<ScanResult> {
  const key = keyOf(args, opts.from)
  let e = entries.get(key)
  if (!e) { e = load(key, opts.from) ?? { from: opts.from, lo: 1n, hi: 0n, logs: [] }; entries.set(key, e) }
  const entry = e
  let job = jobs.get(key)
  if (!job) {
    job = advance(pc, key, args, entry, opts).finally(() => { jobs.delete(key) })
    job.catch(() => { /* surfaced to callers below; keeps background failures from becoming unhandled rejections */ })
    jobs.set(key, job)
  }
  if (opts.budgetMs === undefined) { await job; return { logs: entry.logs, complete: true } }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = await Promise.race([job.then(() => false), new Promise<boolean>(r => { timer = setTimeout(() => r(true), opts.budgetMs) })])
  clearTimeout(timer)
  return { logs: entry.logs, complete: !timedOut && done(entry) }
}

// ── Blockscout (Etherscan-compatible `logs/getLogs`) as a bulk source ──
const HEX = /^0x[0-9a-fA-F]*$/
const toBig = (v: unknown) => { const s = String(v); return BigInt(/^\d+$/.test(s) ? s : s) }

export function blockscoutBulk(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): BulkSource {
  const root = base.replace(/\/+$/, '')
  return async ({ address, topics, from, to }) => {
    const want = address.toLowerCase()
    const seen = new Set<string>()
    const out: Log[] = []
    let start = from
    for (let page = 0; page < 30; page++) {
      const u = new URL(`${root}/api`)
      u.searchParams.set('module', 'logs'); u.searchParams.set('action', 'getLogs')
      u.searchParams.set('fromBlock', String(start)); u.searchParams.set('toBlock', String(to))
      u.searchParams.set('address', address)
      if (topics[0]) u.searchParams.set('topic0', topics[0])
      const res = await fetchFn(u.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
      if (!res.ok) throw new Error(`explorer ${res.status}`)
      const j = await res.json() as { status?: string; message?: string; result?: unknown }
      if (!Array.isArray(j.result)) {
        if (String(j.status) === '0' && /no logs/i.test(String(j.message ?? ''))) break
        throw new Error('explorer: unexpected response')
      }
      let lastBlock = start
      for (const r of j.result as Array<Record<string, unknown>>) {
        const t = (Array.isArray(r.topics) ? r.topics : []).filter((x): x is string => typeof x === 'string')
        if (String(r.address).toLowerCase() !== want || !HEX.test(String(r.data)) || !t.every(x => HEX.test(x)) || (topics[0] && t[0]?.toLowerCase() !== topics[0].toLowerCase())) throw new Error('explorer: log failed validation')
        const blockNumber = toBig(r.blockNumber), logIndex = Number(toBig(r.logIndex ?? 0))
        lastBlock = blockNumber
        const id = `${blockNumber}:${logIndex}:${r.transactionHash}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ address: String(r.address), blockNumber, data: String(r.data), logIndex, topics: t, transactionHash: String(r.transactionHash), removed: false } as unknown as Log)
      }
      if ((j.result as unknown[]).length < 1000) return out.sort(byPosition)
      start = lastBlock // a full page: continue from the last block seen (duplicates are dropped above)
    }
    throw new Error('explorer: too many pages')
  }
}
