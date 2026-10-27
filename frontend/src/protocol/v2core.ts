// AgentBoard V2 adapter: the only module that talks to AgentKernel, EvaluatorRouter and JobBoard.
// Mainnet only. Reads go through the fallback public client; writes are simulated first, sent with an
// explicit fee at or above Arc's 20 Gwei floor, and counted complete only when the receipt succeeded.

import {
  decodeEventLog, encodeFunctionData, encodeAbiParameters, getAddress, isAddress, zeroAddress,
  type Address, type Hex, type Log, type PublicClient,
} from 'viem'
import { boardAbi, kernelAbi, MULTICALL3_FROM, multicall3FromAbi, routerAbi, usdcAbi } from './abis'
import { feeOverrides } from './fees'
import { AppError } from './errors'
import { decodeMeta, decodeUri, encodeMeta, encodeUri, hashBytes, hashText } from './hashing'
import { parseUsdc } from './units'
import type { WindowsCfg } from './state'

// ───────────── environment (injected) ─────────────
// This module has no browser or network-registry imports. The app binds it in v2.ts; the anvil
// end-to-end test binds it to a local chain. That keeps the exact same code under test.

export interface V2Addresses { kernel: Address; router: Address; board: Address; usdc: Address }
export interface WalletLike { writeContract: (a: never) => Promise<Hex> }
export interface V2Env {
  client: () => PublicClient
  signer: () => Promise<{ wc: WalletLike; account: Address }>
  /** EIP-191 personal_sign for the connected account (used to authorise file hosting). */
  signMessage: (message: string) => Promise<Hex>
  addresses: () => V2Addresses
  fromBlock: bigint
  /** Base URL of the serverless API ('' for same origin). */
  apiBase: string
}

let _env: V2Env | null = null
export function configureV2(env: V2Env) { _env = env }
function env(): V2Env {
  if (!_env) throw new Error('V2 adapter is not configured')
  return _env
}

export const v2Addresses = (): V2Addresses => env().addresses()
const client = (): PublicClient => env().client()
export const v2Client = client
/** Event history from the configured start block, with the same range fallback as the rest of the adapter. */
export const getLogsFrom = (args: Record<string, unknown>, opts?: { from?: bigint; steps?: bigint[] }) => getLogsRange(client(), args, opts)
const signer = () => env().signer()
const MAX_META_CHARS = 4000

export const Limits = { maxMetaChars: MAX_META_CHARS }

// ───────────── types ─────────────

export interface Job {
  client: Address; provider: Address; evaluator: Address; hook: Address
  budget: bigint; expiredAt: bigint; submittedAt: bigint; number: bigint
  feeBps: number; status: number; deliverable: Hex
}
export interface RouterJobState { state: number; mode: number; contested: boolean; disputedAt: bigint; deciders: readonly Address[]; votes: readonly number[] }
export interface EvalConfig {
  mode: 0 | 1 | 2; reviewWindow: number; responseWindow: number; decisionWindow: number
  timeoutProviderBps: number; validators: Address[]
}
export interface ListingMeta { title?: string; description?: string; category?: string; link?: string }
export interface Listing {
  id: bigint; client: Address; invitee: Address; maxBudget: bigint; biddingEnds: bigint
  status: number; specHash: Hex; bidCount: number; jobId: bigint
  uri: string; meta: ListingMeta | null; specMatches: boolean | null
}
export interface Bid {
  listingId: bigint; id: number; provider: Address; price: bigint; validUntil: bigint
  status: number; evalConfigHash: Hex; uri: string; proposal: string; config: EvalConfig | null; configVerified: boolean
}
export interface Params { feeBps: number; minBudget: bigint; maxBudget: bigint; paused: boolean; arbitrator: Address; listingCount: bigint }

export const ListingStatus = { None: 0, Open: 1, Filled: 2, Cancelled: 3 } as const
export const BidStatus = { None: 0, Active: 1, Withdrawn: 2, Accepted: 3 } as const

// ───────────── logs ─────────────

async function getLogsRange(pc: PublicClient, args: Record<string, unknown>, opts: { from?: bigint; steps?: bigint[] } = {}): Promise<Log[]> {
  const latest = await pc.getBlockNumber({ cacheTime: 0 }) // viem caches this for ~4s; a stale value hides logs from a just-confirmed transaction
  const start = opts.from ?? env().fromBlock
  const attempt = async (step: bigint): Promise<Log[]> => {
    const out: Log[] = []
    for (let from = start; from <= latest; from += step) {
      const to = from + step - 1n > latest ? latest : from + step - 1n
      const part = await (pc.getLogs as (a: unknown) => Promise<Log[]>)({ ...args, fromBlock: from, toBlock: to })
      out.push(...part)
    }
    return out
  }
  const full = latest - start + 1n
  for (const step of opts.steps ?? [full, 500_000n, 50_000n, 10_000n]) {
    // A step of 0 means "the whole range in one request".
    try { return await attempt(step === 0n ? (full > 0n ? full : 1n) : step) } catch { /* provider range limit: try a smaller step */ }
  }
  throw new AppError('The network could not return event history. Try again in a moment.')
}

// ───────────── reads ─────────────

export async function readParams(): Promise<Params> {
  const pc = client(); const a = v2Addresses()
  const [feeBps, minBudget, maxBudget, paused, arbitrator, listingCount] = await Promise.all([
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'feeBps' }),
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'minBudget' }),
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'maxBudget' }),
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'paused' }),
    pc.readContract({ address: a.router, abi: routerAbi, functionName: 'arbitrator' }),
    pc.readContract({ address: a.board, abi: boardAbi, functionName: 'listingCount' }),
  ])
  return { feeBps: Number(feeBps), minBudget, maxBudget, paused, arbitrator, listingCount }
}

type ListingTuple = readonly [Address, Address, bigint, bigint, number, Hex, number, bigint]

async function readListingRaw(id: bigint): Promise<Omit<Listing, 'uri' | 'meta' | 'specMatches'>> {
  const pc = client(); const a = v2Addresses()
  const t = (await pc.readContract({ address: a.board, abi: boardAbi, functionName: 'listings', args: [id] })) as unknown as ListingTuple
  return { id, client: t[0], invitee: t[1], maxBudget: t[2], biddingEnds: t[3], status: Number(t[4]), specHash: t[5], bidCount: Number(t[6]), jobId: t[7] }
}

function withMeta(raw: Omit<Listing, 'uri' | 'meta' | 'specMatches'>, uri: string): Listing {
  const meta = decodeMeta<ListingMeta>(uri)
  const specMatches = meta?.description ? hashText(meta.description).toLowerCase() === raw.specHash.toLowerCase() : null
  return { ...raw, uri, meta, specMatches }
}

async function listingUris(listingId?: bigint): Promise<Map<string, string>> {
  const pc = client(); const a = v2Addresses()
  const logs = await getLogsRange(pc, {
    address: a.board,
    event: boardAbi.find(x => x.type === 'event' && x.name === 'ListingCreated'),
    ...(listingId !== undefined ? { args: { listingId } } : {}),
  })
  const m = new Map<string, string>()
  for (const l of logs) {
    const d = decodeEventLog({ abi: boardAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
    if (d.eventName === 'ListingCreated') m.set(String(d.args.listingId), d.args.uri)
  }
  return m
}

export async function listListings(limit = 50): Promise<Listing[]> {
  const pc = client(); const a = v2Addresses()
  const count = await pc.readContract({ address: a.board, abi: boardAbi, functionName: 'listingCount' })
  if (count === 0n) return []
  const from = count > BigInt(limit) ? count - BigInt(limit) + 1n : 1n
  const ids: bigint[] = []
  for (let i = count; i >= from; i--) ids.push(i)
  const [raws, uris] = await Promise.all([Promise.all(ids.map(readListingRaw)), listingUris()])
  return raws.map(r => withMeta(r, uris.get(String(r.id)) ?? ''))
}

export async function getListing(id: bigint): Promise<Listing | null> {
  const count = await client().readContract({ address: v2Addresses().board, abi: boardAbi, functionName: 'listingCount' })
  if (id < 1n || id > count) return null
  const [raw, uris] = await Promise.all([readListingRaw(id), listingUris(id)])
  return withMeta(raw, uris.get(String(id)) ?? '')
}

export async function configHashOf(cfg: EvalConfig, arbitrator?: Address): Promise<Hex> {
  const pc = client(); const a = v2Addresses()
  const arb = arbitrator ?? (await pc.readContract({ address: a.router, abi: routerAbi, functionName: 'arbitrator' }))
  return pc.readContract({ address: a.router, abi: routerAbi, functionName: 'computeConfigHash', args: [cfgArg(cfg), arb] })
}

function cfgArg(c: EvalConfig) {
  return { mode: c.mode, reviewWindow: c.reviewWindow, responseWindow: c.responseWindow, decisionWindow: c.decisionWindow, timeoutProviderBps: c.timeoutProviderBps, validators: c.validators }
}

export async function getBids(listing: Listing): Promise<Bid[]> {
  if (listing.bidCount === 0) return []
  const pc = client(); const a = v2Addresses()
  const ids = Array.from({ length: listing.bidCount }, (_, i) => i)
  const [raws, logs, arbitrator] = await Promise.all([
    Promise.all(ids.map(i => pc.readContract({ address: a.board, abi: boardAbi, functionName: 'bids', args: [listing.id, BigInt(i)] }))),
    getLogsRange(pc, { address: a.board, event: boardAbi.find(x => x.type === 'event' && x.name === 'BidPlaced'), args: { listingId: listing.id } }),
    pc.readContract({ address: a.router, abi: routerAbi, functionName: 'arbitrator' }),
  ])
  const uris = new Map<number, string>()
  for (const l of logs) {
    const d = decodeEventLog({ abi: boardAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
    if (d.eventName === 'BidPlaced') uris.set(Number(d.args.bidId), d.args.uri)
  }
  return Promise.all(raws.map(async (r, i) => {
    const t = r as unknown as readonly [Address, bigint, bigint, number, Hex]
    const uri = uris.get(i) ?? ''
    const meta = decodeMeta<{ proposal?: string; config?: EvalConfig }>(uri)
    let config: EvalConfig | null = null
    let configVerified = false
    if (meta?.config) {
      try {
        const c = normaliseConfig(meta.config)
        // A config shown in the UI is trusted only if it hashes to what the bid committed onchain.
        configVerified = (await configHashOf(c, arbitrator)).toLowerCase() === t[4].toLowerCase()
        if (configVerified) config = c
      } catch { /* malformed metadata: treated as unverified */ }
    }
    return { listingId: listing.id, id: i, provider: t[0], price: t[1], validUntil: t[2], status: Number(t[3]), evalConfigHash: t[4], uri, proposal: meta?.proposal ?? '', config, configVerified }
  }))
}

function normaliseConfig(c: EvalConfig): EvalConfig {
  const validators = (c.validators || []).map(v => getAddress(v))
  return { mode: Number(c.mode) as 0 | 1 | 2, reviewWindow: Number(c.reviewWindow), responseWindow: Number(c.responseWindow), decisionWindow: Number(c.decisionWindow), timeoutProviderBps: Number(c.timeoutProviderBps), validators }
}

export interface JobBundle {
  jobId: bigint; job: Job; rs: RouterJobState; listingId: bigint | null; bid: Bid | null
  windows: WindowsCfg | null; deliverableUri: string; description: string; hasVoted: boolean
}

/** Job ids are keccak hashes, so they are looked up by id (from a listing, a link or an event). */
export async function getJobBundle(jobId: bigint, me: Address | null): Promise<JobBundle | null> {
  const pc = client(); const a = v2Addresses()
  const job = (await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'getJob', args: [jobId] })) as unknown as Job
  if (Number(job.status) === 0) return null
  const [rsT, listingId, hasVoted] = await Promise.all([
    pc.readContract({ address: a.router, abi: routerAbi, functionName: 'jobState', args: [jobId] }),
    pc.readContract({ address: a.board, abi: boardAbi, functionName: 'listingOfJob', args: [jobId] }),
    me ? pc.readContract({ address: a.router, abi: routerAbi, functionName: 'hasVoted', args: [jobId, me] }) : Promise.resolve(false),
  ])
  const t = rsT as unknown as readonly [number, number, boolean, bigint, readonly Address[], readonly number[]]
  const rs: RouterJobState = { state: Number(t[0]), mode: Number(t[1]), contested: t[2], disputedAt: t[3], deciders: t[4], votes: t[5] }

  // Windows live in the router but are not exposed by a view. Take them from the accepted bid's
  // metadata, and only when that metadata hashes to the config the router stored.
  let bid: Bid | null = null
  let windows: WindowsCfg | null = null
  const lid = listingId === 0n ? null : listingId
  if (lid) {
    const listing = await getListing(lid)
    if (listing) {
      const bids = await getBids(listing)
      bid = bids.find(b => b.status === BidStatus.Accepted) ?? null
      const stored = await pc.readContract({ address: a.router, abi: routerAbi, functionName: 'configHash', args: [jobId] })
      if (bid?.config && bid.evalConfigHash.toLowerCase() === stored.toLowerCase()) {
        windows = { reviewWindow: bid.config.reviewWindow, responseWindow: bid.config.responseWindow, decisionWindow: bid.config.decisionWindow }
      }
    }
  }

  let deliverableUri = ''
  let description = ''
  try {
    const [sub, created] = await Promise.all([
      Number(job.status) >= 3 ? getLogsRange(pc, { address: a.kernel, event: kernelAbi.find(x => x.type === 'event' && x.name === 'JobSubmitted'), args: { jobId } }) : Promise.resolve([] as Log[]),
      getLogsRange(pc, { address: a.kernel, event: kernelAbi.find(x => x.type === 'event' && x.name === 'JobCreated'), args: { jobId } }),
    ])
    const s = sub.at(-1)
    if (s) {
      const d = decodeEventLog({ abi: kernelAbi, data: s.data, topics: s.topics as [Hex, ...Hex[]] })
      if (d.eventName === 'JobSubmitted') deliverableUri = decodeUri(d.args.optParams)
    }
    const c = created.at(0)
    if (c) {
      const d = decodeEventLog({ abi: kernelAbi, data: c.data, topics: c.topics as [Hex, ...Hex[]] })
      if (d.eventName === 'JobCreated') description = d.args.description
    }
  } catch { /* event history is display-only; actions still work without it */ }

  return { jobId, job: { ...job, status: Number(job.status), feeBps: Number(job.feeBps) }, rs, listingId: lid, bid, windows, deliverableUri, description, hasVoted: !!hasVoted }
}

export interface Dashboard { listings: Listing[]; bids: { listing: Listing; bid: Bid }[]; jobs: JobRow[]; claimable: bigint }

export async function getDashboard(me: Address, scan = 100): Promise<Dashboard> {
  const pc = client(); const a = v2Addresses()
  const all = await listListings(scan)
  const mine = all.filter(l => l.client.toLowerCase() === me.toLowerCase())
  const open = all.filter(l => l.bidCount > 0 && l.client.toLowerCase() !== me.toLowerCase())
  const bidRows: { listing: Listing; bid: Bid }[] = []
  await Promise.all(open.map(async l => {
    const bs = await getBids(l)
    for (const b of bs) if (b.provider.toLowerCase() === me.toLowerCase()) bidRows.push({ listing: l, bid: b })
  }))
  const boardJobIds = [...mine.filter(l => l.status === ListingStatus.Filled).map(l => l.jobId), ...bidRows.filter(r => r.bid.status === BidStatus.Accepted).map(r => r.listing.jobId)]
  const [claimable, jobs] = await Promise.all([
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'claimable', args: [me] }),
    getMyJobs(me, boardJobIds),
  ])
  return { listings: mine, bids: bidRows, jobs, claimable }
}

export async function usdcBalance(who: Address): Promise<bigint> {
  const a = v2Addresses()
  return client().readContract({ address: a.usdc, abi: usdcAbi, functionName: 'balanceOf', args: [who] })
}

// ───────────── writes ─────────────

export interface TxResult { hash: Hex }

export type WriteArgs = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }

export async function send(w: WriteArgs): Promise<TxResult> {
  const pc = client()
  const { wc, account } = await signer()
  const fees = await feeOverrides(pc)
  // Simulate first: reverts surface as readable errors before any wallet prompt, and before gas is spent.
  const sim = await (pc.simulateContract as (a: unknown) => Promise<{ request: unknown }>)({ ...w, account, ...fees })
  const hash = await (wc.writeContract as unknown as (a: unknown) => Promise<Hex>)({ ...(sim.request as object), ...fees })
  const receipt = await pc.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new AppError('The transaction was included but failed. Check the receipt before retrying.')
  return { hash }
}

const k = () => v2Addresses().kernel
const r = () => v2Addresses().router
const b = () => v2Addresses().board

export const createListing = (p: { title: string; description: string; maxBudget: string; biddingEnds: bigint; invitee: string }) => {
  const description = p.description.trim()
  if (!p.title.trim() || !description) throw new AppError('Add a title and the acceptance criteria.')
  if (description.length > MAX_META_CHARS) throw new AppError(`Keep the acceptance criteria under ${MAX_META_CHARS} characters.`)
  const invitee = p.invitee.trim() ? p.invitee.trim() : zeroAddress
  if (!isAddress(invitee)) throw new AppError('The invited agent address is not valid.')
  const maxBudget = parseUsdc(p.maxBudget)
  const uri = encodeMeta({ v: 1, title: p.title.trim(), description })
  return send({ address: b(), abi: boardAbi, functionName: 'createListing', args: [hashText(description), maxBudget, p.biddingEnds, invitee, uri] })
}
export const cancelListing = (id: bigint) => send({ address: b(), abi: boardAbi, functionName: 'cancelListing', args: [id] })

export async function placeBid(p: { listingId: bigint; price: string; config: EvalConfig; validUntil: bigint; proposal: string }) {
  const params = await readParams()
  const price = parseUsdc(p.price)
  if (price < params.minBudget) throw new AppError('That price is below the platform minimum, so it could never be funded.')
  if (price > params.maxBudget) throw new AppError('That price is above the current launch maximum, so it could not be funded.')
  const config = normaliseConfig(p.config)
  const hash = await configHashOf(config, params.arbitrator)
  const uri = encodeMeta({ v: 1, proposal: p.proposal.trim().slice(0, 2000), config })
  return send({ address: b(), abi: boardAbi, functionName: 'placeBid', args: [p.listingId, price, hash, p.validUntil, uri] })
}
export const withdrawBid = (listingId: bigint, bidId: number) => send({ address: b(), abi: boardAbi, functionName: 'withdrawBid', args: [listingId, BigInt(bidId)] })

// Hire: five steps, resumable. Each step is skipped when the chain already shows it done, so a reload
// or a failed step never double-spends or double-creates. Sequential on purpose until the
// Multicall3From interface is confirmed with `cast interface`.
export interface HireStep { id: 'approve' | 'create' | 'configure' | 'budget' | 'fund'; label: string }
export const HIRE_STEPS: HireStep[] = [
  { id: 'approve', label: 'Allow USDC for this job' },
  { id: 'create', label: 'Create the job' },
  { id: 'configure', label: 'Lock in the agreed evaluation terms' },
  { id: 'budget', label: 'Set the agreed price' },
  { id: 'fund', label: 'Fund escrow' },
]

const hireKey = (clientAddr: string, listingId: bigint, bidId: number) => `agentboard.hire.${clientAddr.toLowerCase()}.${listingId}.${bidId}`

export async function runHire(p: { listing: Listing; bid: Bid; deadlineDays: number; onStep: (id: HireStep['id'], state: 'start' | 'done') => void; onMode?: (m: 'batch' | 'sequential') => void; allowBatch?: boolean }): Promise<{ jobId: bigint; hash: Hex }> {
  const pc = client(); const a = v2Addresses()
  const { account } = await signer()
  const { listing, bid } = p
  if (account.toLowerCase() !== listing.client.toLowerCase()) throw new AppError('Only the listing owner can hire.')
  if (!bid.config || !bid.configVerified) throw new AppError('This bid\u2019s evaluation terms could not be verified against its onchain hash. Do not hire it.')
  const params = await readParams()
  if (params.paused) throw new AppError('New jobs and funding are paused by the operator.')
  if (bid.price < params.minBudget || bid.price > params.maxBudget) throw new AppError('This price is outside the current launch limits and cannot be funded.')

  const key = hireKey(account, listing.id, bid.id)
  let jobId: bigint | null = null
  try { const s = localStorage.getItem(key); if (s) jobId = BigInt(s) } catch { /* storage blocked: fine, resume is a convenience */ }

  // Fast path: one wallet confirmation through Multicall3From (fresh hires only). Every call runs with
  // the wallet as msg.sender, so the job's client is the buyer and the kernel pulls USDC from them.
  // The batch is simulated first; if the simulation or the send fails for any reason other than the
  // user rejecting it, nothing was applied (the batch is atomic) and the sequential flow takes over.
  if (jobId === null && p.allowBatch !== false) {
    try {
      const batched = await tryBatchedHire({ pc, a, account, listing, bid, deadlineDays: p.deadlineDays, key })
      if (batched) {
        p.onMode?.('batch')
        for (const s of HIRE_STEPS) p.onStep(s.id, 'done')
        return batched
      }
    } catch (e) {
      const c = (e as { code?: number | string })?.code
      if (c === 4001 || c === 'ACTION_REJECTED' || /user rejected|user denied/i.test((e as Error)?.message || '')) throw e
      // fall through to the sequential flow
    }
  }
  p.onMode?.('sequential')

  let lastHash: Hex = '0x'
  const run = async (id: HireStep['id'], w: WriteArgs) => { p.onStep(id, 'start'); lastHash = (await send(w)).hash; p.onStep(id, 'done') }

  // 1. allowance (exact amount, never unlimited)
  const allowance = await pc.readContract({ address: a.usdc, abi: usdcAbi, functionName: 'allowance', args: [account, a.kernel] })
  if (allowance < bid.price) await run('approve', { address: a.usdc, abi: usdcAbi, functionName: 'approve', args: [a.kernel, bid.price] })
  else p.onStep('approve', 'done')

  // 2. job
  let existing: Job | null = null
  if (jobId !== null) {
    const j = (await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'getJob', args: [jobId] })) as unknown as Job
    if (Number(j.status) !== 0) existing = j
  }
  if (!existing || jobId === null) {
    jobId = await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'predictJobId', args: [account] })
    try { localStorage.setItem(key, jobId.toString()) } catch { /* ignore */ }
    // Chain time, not wall-clock time: the kernel checks the deadline against block.timestamp.
    const chainNow = (await pc.getBlock()).timestamp
    const expiredAt = chainNow + BigInt(p.deadlineDays * 86400)
    await run('create', { address: a.kernel, abi: kernelAbi, functionName: 'createJob', args: [bid.provider, a.router, expiredAt, `AgentBoard listing #${listing.id}`, a.board] })
  } else {
    if (Number(existing.status) !== 1) throw new AppError('This hire was already funded or closed. Open the job page instead.')
    p.onStep('create', 'done')
  }

  // 3. evaluation terms
  const stored = await pc.readContract({ address: a.router, abi: routerAbi, functionName: 'configHash', args: [jobId] })
  if (stored === `0x${'0'.repeat(64)}`) await run('configure', { address: a.router, abi: routerAbi, functionName: 'configure', args: [jobId, cfgArg(bid.config)] })
  else p.onStep('configure', 'done')

  // 4. price
  const cur = (await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'getJob', args: [jobId] })) as unknown as Job
  if (cur.budget !== bid.price) await run('budget', { address: a.kernel, abi: kernelAbi, functionName: 'setBudget', args: [jobId, bid.price, '0x'] })
  else p.onStep('budget', 'done')

  // 5. fund, binding the bid atomically through the board hook
  const optParams = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [listing.id, BigInt(bid.id)])
  await run('fund', { address: a.kernel, abi: kernelAbi, functionName: 'fund', args: [jobId, bid.price, optParams] })
  try { localStorage.removeItem(key) } catch { /* ignore */ }
  return { jobId, hash: lastHash }
}

async function tryBatchedHire(p: { pc: PublicClient; a: V2Addresses; account: Address; listing: Listing; bid: Bid; deadlineDays: number; key: string }): Promise<{ jobId: bigint; hash: Hex } | null> {
  const { pc, a, account, listing, bid } = p
  const code = await pc.getCode({ address: MULTICALL3_FROM })
  if (!code || code === '0x') return null
  const [allowance, jobId, chainNow] = await Promise.all([
    pc.readContract({ address: a.usdc, abi: usdcAbi, functionName: 'allowance', args: [account, a.kernel] }),
    pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'predictJobId', args: [account] }),
    pc.getBlock().then(b => b.timestamp),
  ])
  const expiredAt = chainNow + BigInt(p.deadlineDays * 86400)
  const optParams = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [listing.id, BigInt(bid.id)])
  const calls: { target: Address; allowFailure: boolean; callData: Hex }[] = []
  if (allowance < bid.price) calls.push({ target: a.usdc, allowFailure: false, callData: encodeFunctionData({ abi: usdcAbi, functionName: 'approve', args: [a.kernel, bid.price] }) })
  calls.push(
    { target: a.kernel, allowFailure: false, callData: encodeFunctionData({ abi: kernelAbi, functionName: 'createJob', args: [bid.provider, a.router, expiredAt, `AgentBoard listing #${listing.id}`, a.board] }) },
    { target: a.router, allowFailure: false, callData: encodeFunctionData({ abi: routerAbi, functionName: 'configure', args: [jobId, cfgArg(bid.config as EvalConfig)] }) },
    { target: a.kernel, allowFailure: false, callData: encodeFunctionData({ abi: kernelAbi, functionName: 'setBudget', args: [jobId, bid.price, '0x'] }) },
    { target: a.kernel, allowFailure: false, callData: encodeFunctionData({ abi: kernelAbi, functionName: 'fund', args: [jobId, bid.price, optParams] }) },
  )
  const { hash } = await send({ address: MULTICALL3_FROM, abi: multicall3FromAbi, functionName: 'aggregate3', args: [calls] })
  // Confirm from chain state, not from the send result alone.
  const j = (await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'getJob', args: [jobId] })) as unknown as Job
  if (Number(j.status) !== 2) throw new AppError('The batched transaction did not fund the job.')
  try { localStorage.removeItem(p.key) } catch { /* ignore */ }
  return { jobId, hash }
}

export const submitWork = (jobId: bigint, deliverable: Hex, uri: string) =>
  send({ address: k(), abi: kernelAbi, functionName: 'submit', args: [jobId, deliverable, encodeUri(uri)] })
export const approve = (jobId: bigint) => send({ address: r(), abi: routerAbi, functionName: 'approve', args: [jobId] })
export const rejectWork = (jobId: bigint, reasonHash: Hex, evidenceHash: Hex) => send({ address: r(), abi: routerAbi, functionName: 'reject', args: [jobId, reasonHash, evidenceHash] })
export const acceptRejection = (jobId: bigint) => send({ address: r(), abi: routerAbi, functionName: 'acceptRejection', args: [jobId] })
export const contest = (jobId: bigint, evidenceHash: Hex) => send({ address: r(), abi: routerAbi, functionName: 'contest', args: [jobId, evidenceHash] })
export const vote = (jobId: bigint, providerBps: number, evidenceHash: Hex) => send({ address: r(), abi: routerAbi, functionName: 'vote', args: [jobId, providerBps, evidenceHash] })
export const autoRelease = (jobId: bigint) => send({ address: r(), abi: routerAbi, functionName: 'autoRelease', args: [jobId] })
export const finalizeUncontested = (jobId: bigint) => send({ address: r(), abi: routerAbi, functionName: 'finalizeUncontested', args: [jobId] })
export const finalizeTimeout = (jobId: bigint) => send({ address: r(), abi: routerAbi, functionName: 'finalizeTimeout', args: [jobId] })
export const claimRefund = (jobId: bigint) => send({ address: k(), abi: kernelAbi, functionName: 'claimRefund', args: [jobId] })
export const extendDeadline = (jobId: bigint, newExpiredAt: bigint) => send({ address: k(), abi: kernelAbi, functionName: 'extendDeadline', args: [jobId, newExpiredAt] })
export const cancelOpenJob = (jobId: bigint) => send({ address: k(), abi: kernelAbi, functionName: 'reject', args: [jobId, `0x${'0'.repeat(64)}` as Hex, '0x'] })
export const withdrawClaimable = (to: Address) => send({ address: k(), abi: kernelAbi, functionName: 'withdrawClaimable', args: [to] })

// ───────────── receipts (chain data only) ─────────────

const SYSTEM_EMITTER = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE'.toLowerCase()
const ALL_ABIS = [...kernelAbi, ...routerAbi, ...boardAbi, ...usdcAbi] as const

export interface ReceiptEvent { contract: 'kernel' | 'router' | 'board'; name: string; args: Record<string, unknown> }
export interface UsdcMove { from: Address; to: Address; amount: bigint }
export interface Receipt { hash: Hex; status: 'success' | 'reverted'; block: bigint; from: Address; to: Address | null; events: ReceiptEvent[]; usdc: UsdcMove[] }

export async function readReceipt(hash: Hex): Promise<Receipt | null> {
  const pc = client(); const a = v2Addresses()
  let rc
  try { rc = await pc.getTransactionReceipt({ hash }) } catch { return null }
  const events: ReceiptEvent[] = []
  const erc20: UsdcMove[] = []
  const native: UsdcMove[] = []
  for (const log of rc.logs) {
    const addr = log.address.toLowerCase()
    const which = addr === a.kernel.toLowerCase() ? 'kernel' : addr === a.router.toLowerCase() ? 'router' : addr === a.board.toLowerCase() ? 'board' : null
    try {
      const d = decodeEventLog({ abi: ALL_ABIS, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
      if (which) events.push({ contract: which, name: d.eventName as string, args: d.args as unknown as Record<string, unknown> })
      else if (d.eventName === 'Transfer') {
        const t = d.args as unknown as { from: Address; to: Address; value: bigint }
        if (addr === a.usdc.toLowerCase()) erc20.push({ from: t.from, to: t.to, amount: t.value })
        else if (addr === SYSTEM_EMITTER) native.push({ from: t.from, to: t.to, amount: t.value / 10n ** 12n })
      }
    } catch { /* unrelated log */ }
  }
  // The native (18-decimal) emitter mirrors the ERC-20 events. Count a transfer once: ERC-20 first,
  // then native-only moves that have no ERC-20 twin.
  const usdc = [...erc20]
  for (const n of native) if (!erc20.some(e => e.from === n.from && e.to === n.to && e.amount === n.amount)) usdc.push(n)
  return { hash, status: rc.status === 'success' ? 'success' : 'reverted', block: rc.blockNumber, from: rc.from, to: rc.to, events, usdc }
}


// ───────────── job discovery and dispute record (no indexer) ─────────────

export interface JobRow { jobId: bigint; number: bigint; role: 'buyer' | 'seller'; status: number; budget: bigint; client: Address; provider: Address }

const jobTopicEvent = (name: string) => kernelAbi.find(x => x.type === 'event' && x.name === name)

/** Jobs where `me` is buyer (any job, including ones created straight on the kernel) or seller. */
export async function getMyJobs(me: Address, boardJobIds: bigint[] = []): Promise<JobRow[]> {
  const pc = client(); const a = v2Addresses()
  const [created, submitted] = await Promise.all([
    getLogsRange(pc, { address: a.kernel, event: jobTopicEvent('JobCreated'), args: { client: me } }),
    getLogsRange(pc, { address: a.kernel, event: jobTopicEvent('JobSubmitted'), args: { provider: me } }),
  ])
  const ids = new Set<string>(boardJobIds.filter(j => j !== 0n).map(String))
  for (const l of [...created, ...submitted]) {
    const d = decodeEventLog({ abi: kernelAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
    if (d.eventName === 'JobCreated' || d.eventName === 'JobSubmitted') ids.add(String(d.args.jobId))
  }
  const rows: JobRow[] = []
  await Promise.all([...ids].map(async s => {
    const jobId = BigInt(s)
    const j = (await pc.readContract({ address: a.kernel, abi: kernelAbi, functionName: 'getJob', args: [jobId] })) as unknown as Job
    if (Number(j.status) === 0) return
    const buyer = j.client.toLowerCase() === me.toLowerCase()
    if (!buyer && j.provider.toLowerCase() !== me.toLowerCase()) return
    rows.push({ jobId, number: j.number, role: buyer ? 'buyer' : 'seller', status: Number(j.status), budget: j.budget, client: j.client, provider: j.provider })
  }))
  return rows.sort((x, y) => (x.number < y.number ? 1 : -1))
}

export interface DisputeEntry { kind: 'reason' | 'evidence' | 'contest' | 'vote'; hash: Hex; by?: Address; providerBps?: number }

/** Every hash committed during a dispute, straight from router events. */
export async function getDisputeRecord(jobId: bigint): Promise<DisputeEntry[]> {
  const pc = client(); const a = v2Addresses()
  const ev = (n: string) => routerAbi.find(x => x.type === 'event' && x.name === n)
  const [opened, contested, voted] = await Promise.all([
    getLogsRange(pc, { address: a.router, event: ev('DisputeOpened'), args: { jobId } }),
    getLogsRange(pc, { address: a.router, event: ev('Contested'), args: { jobId } }),
    getLogsRange(pc, { address: a.router, event: ev('Voted'), args: { jobId } }),
  ])
  const out: DisputeEntry[] = []
  for (const l of [...opened, ...contested, ...voted]) {
    const d = decodeEventLog({ abi: routerAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
    if (d.eventName === 'DisputeOpened') { out.push({ kind: 'reason', hash: d.args.reasonHash }, { kind: 'evidence', hash: d.args.evidenceHash }) }
    else if (d.eventName === 'Contested') out.push({ kind: 'contest', hash: d.args.evidenceHash })
    else if (d.eventName === 'Voted') out.push({ kind: 'vote', hash: d.args.evidenceHash, by: d.args.decider, providerBps: Number(d.args.providerBps) })
  }
  return out
}

// ───────────── file hosting (serverless /api/upload, Vercel Blob) ─────────────

export type PinKind = 'deliverable' | 'evidence' | 'reason'
export interface HostedFile { url: string; kind?: string; keccak?: string; name?: string; size?: number; uploadedAt?: string }

export const MAX_HOSTED_BYTES = 4 * 1024 * 1024

export const uploadMessage = (p: { jobId: string; kind: string; hash: string; issuedAt: string }) =>
  `AgentBoard upload\nJob: ${p.jobId}\nKind: ${p.kind}\nHash: ${p.hash}\nIssued: ${p.issuedAt}`

function b64(bytes: Uint8Array): string {
  let s = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(s)
}

/** Host bytes. Throws AppError with a plain message; callers may continue hash-only. */
export async function hostFile(p: { jobId: bigint; kind: PinKind; bytes: Uint8Array; name: string }): Promise<{ url: string; hash: Hex }> {
  if (p.bytes.length > MAX_HOSTED_BYTES) throw new AppError('Files must be 4 MB or smaller to host.')
  const { account } = await signer()
  const hash = hashBytes(p.bytes)
  const issuedAt = String(Math.floor(Date.now() / 1000))
  const signature = await env().signMessage(uploadMessage({ jobId: p.jobId.toString(), kind: p.kind, hash, issuedAt }))
  let res: Response
  try {
    res = await fetch(`${env().apiBase}/api/upload`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: p.jobId.toString(), kind: p.kind, name: p.name, contentBase64: b64(p.bytes), hash, address: account, signature, issuedAt }),
    })
  } catch { throw new AppError('File hosting is unreachable right now.') }
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !j.url) throw new AppError(j.error || 'File hosting failed.')
  return { url: j.url, hash }
}

export async function listFiles(jobId: bigint): Promise<{ configured: boolean; files: HostedFile[] }> {
  try {
    const res = await fetch(`${env().apiBase}/api/files?jobId=${jobId}`)
    if (!res.ok) return { configured: false, files: [] }
    return (await res.json()) as { configured: boolean; files: HostedFile[] }
  } catch { return { configured: false, files: [] } }
}
