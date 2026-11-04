// Event-history reader for the browser. Mainnet (v2) listings, bids and jobs are read from contract
// events, and the RPC providers cap eth_getLogs by block range. Reading it naively means:
//   - every query re-scans the whole history from the deployment block, one request after another;
//   - the dashboard starts many such scans in parallel and the 30s refetch repeats them;
//   - the cost grows with every block (Arc makes about 170,000 a day).
// This module keeps the first load bounded and makes every later read incremental:
//   - ranges are requested largest-first and the size the provider accepts is remembered;
//   - chunks run with limited concurrency instead of strictly one after another;
//   - results are cached per query, and a refresh only asks for blocks after the last scanned one
//     (Arc finality is deterministic, so blocks at or before that point cannot change);
//   - identical scans started at the same time share one promise.
import type { Log, PublicClient } from 'viem'

export interface ScanOptions {
  from: bigint
  /** Range sizes to try, largest first. */
  steps?: bigint[]
  concurrency?: number
}

export const DEFAULT_STEPS: bigint[] = [100_000n, 50_000n, 10_000n, 2_000n, 500n]
const DEFAULT_CONCURRENCY = 4

interface Entry { from: bigint; to: bigint; logs: Log[] }
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<Log[]>>()
let learnedStep: bigint | null = null

export const resetLogScanState = () => { cache.clear(); inflight.clear(); learnedStep = null }
export const learnedRangeStep = () => learnedStep

const keyOf = (args: Record<string, unknown>, from: bigint) =>
  JSON.stringify({ ...args, event: (args.event as { name?: string } | undefined)?.name, from }, (_k, v) => (typeof v === 'bigint' ? `${v}n` : _k === 'event' && typeof v === 'object' ? undefined : v))

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

async function scanFresh(pc: PublicClient, args: Record<string, unknown>, from: bigint, to: bigint, opts: ScanOptions): Promise<Log[]> {
  if (from > to) return []
  const steps = opts.steps ?? DEFAULT_STEPS
  // Start at the size this provider already accepted, if we learned one and it is in the allowed list.
  const startIdx = learnedStep !== null ? Math.max(0, steps.findIndex(s => s <= learnedStep!)) : 0
  let lastError: unknown
  for (const step of steps.slice(startIdx)) {
    try {
      const logs = await fetchChunks(pc, args, from, to, step, opts.concurrency ?? DEFAULT_CONCURRENCY)
      if (to - from + 1n > step) learnedStep = step // only a multi-chunk scan proves the size is accepted
      return logs
    } catch (e) { lastError = e /* range or result limit: retry with a smaller step */ }
  }
  throw lastError ?? new Error('getLogs failed')
}

/** All logs matching `args` from `opts.from` to the chain tip. Later calls only fetch new blocks. */
export function scanLogs(pc: PublicClient, args: Record<string, unknown>, opts: ScanOptions): Promise<Log[]> {
  const key = keyOf(args, opts.from)
  const running = inflight.get(key)
  if (running) return running
  const p = (async () => {
    // viem caches the block number for ~4s; a stale value would hide logs from a just-confirmed transaction.
    const latest = await pc.getBlockNumber({ cacheTime: 0 })
    const hit = cache.get(key)
    const base = hit ? hit.logs : []
    const start = hit ? hit.to + 1n : opts.from
    if (hit && start > latest) return hit.logs
    const fresh = await scanFresh(pc, args, start, latest, opts)
    const logs = fresh.length ? base.concat(fresh) : base
    cache.set(key, { from: opts.from, to: latest, logs })
    return logs
  })().finally(() => { inflight.delete(key) })
  inflight.set(key, p)
  return p
}
