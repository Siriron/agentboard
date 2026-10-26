import { beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { createPublicClient, createWalletClient, defineChain, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as v2 from '../src/protocol/v2core'
import { kernelAbi, usdcAbi } from '../src/protocol/abis'
import { describeJob, JobStatus } from '../src/protocol/state'
import { hashText } from '../src/protocol/hashing'
import { parseUsdc } from '../src/protocol/units'
import { keccak256 } from 'viem'

// Route the app's /api/upload and /api/files calls to the real serverless handlers.
// Only the Vercel Blob SDK is mocked (in-memory store).
vi.mock('@vercel/blob', () => {
  const store = new Map<string, { size: number }>()
  return {
    put: async (path: string, body: Buffer) => { store.set(path, { size: body.length }); return { url: `https://blob.test/${path}` } },
    list: async ({ prefix }: { prefix: string }) => ({ blobs: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ url: `https://blob.test/${k}`, pathname: k, size: v.size, uploadedAt: 'now' })) }),
  }
})
// localStorage shim: runHire uses it for resume bookkeeping.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
} as Storage

const dep = inject('deployment')
process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
process.env.V2_KERNEL = dep.kernel
process.env.V2_ROUTER = dep.router
process.env.ARC_MAINNET_RPC = dep.rpc
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  const call = async (path: string) => {
    const mod = (await import(`../api/${path}.js`)) as { default: (req: unknown, res: unknown) => Promise<void> }
    let status = 200; let body: unknown = null
    const res = { setHeader() {}, status(c: number) { status = c; return res }, json(b: unknown) { body = b; return res }, end() { return res } }
    const u = new URL(url)
    await mod.default({ method: init?.method ?? 'GET', headers: { origin: 'http://api.local', host: 'api.local' }, body: init?.body ? JSON.parse(String(init.body)) : undefined, query: Object.fromEntries(u.searchParams) }, res)
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  if (url.startsWith('http://api.local/api/files?')) return call('files')
  if (url === 'http://api.local/api/upload') return call('upload')
  return realFetch(input as never, init)
}) as typeof fetch
const USDC = '0x3600000000000000000000000000000000000000' as Address
const KEY = {
  owner: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  buyer: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  seller: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  validator: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  stranger: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
} as const
const chain = defineChain({ id: 5042, name: 'anvil-arc', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [dep.rpc] } } })
const pc = createPublicClient({ chain, transport: http(dep.rpc) })
const acct = (k: keyof typeof KEY) => privateKeyToAccount(KEY[k])
const DAY = 86400

function actAs(k: keyof typeof KEY) {
  const account = acct(k)
  const wc = createWalletClient({ account, chain, transport: http(dep.rpc) })
  v2.configureV2({
    fromBlock: 0n, client: () => pc as never,
    addresses: () => ({ kernel: dep.kernel as Address, router: dep.router as Address, board: dep.board as Address, usdc: USDC }),
    signer: async () => ({ wc: wc as never, account: account.address }),
    signMessage: message => account.signMessage({ message }),
    apiBase: 'http://api.local',
  })
  return account.address
}
const bal = (a: Address) => pc.readContract({ address: USDC, abi: usdcAbi, functionName: 'balanceOf', args: [a] })
const chainNow = async () => Number((await pc.getBlock()).timestamp)
async function warp(secs: number) { await pc.request({ method: 'evm_increaseTime' as never, params: [secs] as never }); await pc.request({ method: 'evm_mine' as never, params: [] as never }) }
const noop = () => {}

const baseCfg = (o: Partial<v2.EvalConfig> = {}): v2.EvalConfig => ({ mode: 0, reviewWindow: DAY, responseWindow: DAY, decisionWindow: 2 * DAY, timeoutProviderBps: 5000, validators: [], ...o })

/** Post a listing, bid, and hire. Returns the funded job id. */
async function hireFlow(price: string, cfg: v2.EvalConfig, deadlineDays = 14) {
  const buyer = actAs('buyer')
  const now = await chainNow()
  await v2.createListing({ title: 'Test job', description: 'Deliver a report.', maxBudget: '500', biddingEnds: BigInt(now + 7 * DAY), invitee: '' })
  const listingId = (await v2.readParams()).listingCount
  const seller = actAs('seller')
  await v2.placeBid({ listingId, price, config: cfg, validUntil: BigInt(now + 5 * DAY), proposal: 'I can do it.' })
  actAs('buyer')
  const listing = (await v2.getListing(listingId))!
  const bids = await v2.getBids(listing)
  expect(bids).toHaveLength(1)
  expect(bids[0]!.configVerified).toBe(true)
  const { jobId } = await v2.runHire({ listing, bid: bids[0]!, deadlineDays, onStep: noop })
  return { jobId, listingId, buyer, seller }
}
const bundle = async (jobId: bigint, me: Address | null = null) => (await v2.getJobBundle(jobId, me))!
const submit = async (jobId: bigint) => { actAs('seller'); await v2.submitWork(jobId, hashText('the report'), 'https://example.com/report.pdf') }

beforeAll(async () => {
  for (const k of ['buyer', 'seller', 'validator', 'stranger'] as const) expect(acct(k).address.toLowerCase()).toBe(dep.accounts[['owner', 'buyer', 'seller', 'validator', 'stranger'].indexOf(k)]!.toLowerCase())
  const owner = createWalletClient({ account: acct('owner'), chain, transport: http(dep.rpc) })
  const h = await owner.writeContract({ address: USDC, abi: [{ type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amt', type: 'uint256' }], outputs: [] }], functionName: 'mint', args: [acct('buyer').address, parseUsdc('10000')] })
  await pc.waitForTransactionReceipt({ hash: h })
})

describe('V2 adapter against the real contracts (local anvil, chain id 5042)', () => {
  it('reads launch parameters', async () => {
    actAs('buyer')
    const p = await v2.readParams()
    expect(p.feeBps).toBe(100)
    expect(p.minBudget).toBe(10_000n)
    expect(p.paused).toBe(false)
  })

  it('happy path: list, bid, hire, submit, approve; seller gets 99%, treasury 1%', async () => {
    const treasury = dep.accounts[9] as Address
    const t0 = await bal(treasury)
    const { jobId, seller, buyer } = await hireFlow('100', baseCfg())
    let b = await bundle(jobId, buyer)
    expect(b.job.status).toBe(JobStatus.Funded)
    expect(await bal(buyer)).toBe(parseUsdc('10000') - parseUsdc('100'))
    expect(b.listingId).not.toBeNull()
    expect(b.windows).toEqual({ reviewWindow: DAY, responseWindow: DAY, decisionWindow: 2 * DAY })

    await submit(jobId)
    b = await bundle(jobId, buyer)
    expect(b.job.status).toBe(JobStatus.Submitted)
    expect(b.deliverableUri).toBe('https://example.com/report.pdf')
    const view = describeJob({ job: b.job, rs: b.rs, cfg: b.windows, me: buyer, now: await chainNow() })
    expect(view.actions.map(a => a.id)).toEqual(['approve', 'reject'])

    const s0 = await bal(seller)
    actAs('buyer'); const tx = await v2.approve(jobId)
    expect((await bundle(jobId)).job.status).toBe(JobStatus.Completed)
    expect((await bal(seller)) - s0).toBe(parseUsdc('99'))
    expect((await bal(treasury)) - t0).toBe(parseUsdc('1'))

    const rc = await v2.readReceipt(tx.hash)
    expect(rc?.status).toBe('success')
    expect(rc?.events.some(e => e.name === 'JobCompleted')).toBe(true)
    expect(rc?.usdc.some(m => m.to === seller && m.amount === parseUsdc('99'))).toBe(true)
  })

  it('silent buyer: seller is paid by autoRelease after the review window', async () => {
    const { jobId, seller } = await hireFlow('20', baseCfg())
    await submit(jobId)
    const s0 = await bal(seller)
    actAs('stranger')
    await expect(v2.autoRelease(jobId)).rejects.toBeTruthy() // window still open
    await warp(DAY + 5)
    const b = await bundle(jobId)
    expect(describeJob({ job: b.job, rs: b.rs, cfg: b.windows, me: null, now: await chainNow() }).actions.map(a => a.id)).toEqual(['autoRelease'])
    await v2.autoRelease(jobId)
    expect((await bundle(jobId)).job.status).toBe(JobStatus.Completed)
    expect((await bal(seller)) - s0).toBe(parseUsdc('19.8'))
  })

  it('uncontested rejection: buyer is fully refunded after the response window', async () => {
    const { jobId, buyer } = await hireFlow('30', baseCfg())
    await submit(jobId)
    const b0 = await bal(buyer)
    actAs('buyer'); await v2.rejectWork(jobId, hashText('wrong format'), hashText('evidence'))
    let b = await bundle(jobId)
    expect(b.rs.state).toBe(2)
    actAs('stranger')
    await expect(v2.finalizeUncontested(jobId)).rejects.toBeTruthy()
    await warp(DAY + 5)
    await v2.finalizeUncontested(jobId)
    b = await bundle(jobId)
    expect(b.job.status).toBe(JobStatus.Rejected)
    expect((await bal(buyer)) - b0).toBe(parseUsdc('30'))
  })

  it('seller accepts a rejection: immediate refund', async () => {
    const { jobId, buyer } = await hireFlow('15', baseCfg())
    await submit(jobId)
    actAs('buyer'); await v2.rejectWork(jobId, hashText('r'), hashText('e'))
    const b0 = await bal(buyer)
    actAs('seller'); await v2.acceptRejection(jobId)
    expect((await bal(buyer)) - b0).toBe(parseUsdc('15'))
  })

  it('contested dispute with a validator: split by the validator vote (30% seller)', async () => {
    const validator = acct('validator').address
    const { jobId, buyer, seller } = await hireFlow('100', baseCfg({ mode: 1, validators: [validator] }))
    await submit(jobId)
    actAs('buyer'); await v2.rejectWork(jobId, hashText('r'), hashText('e'))
    actAs('seller'); await v2.contest(jobId, hashText('my evidence'))
    let b = await bundle(jobId, validator)
    const view = describeJob({ job: b.job, rs: b.rs, cfg: b.windows, me: validator, hasVoted: b.hasVoted, now: await chainNow() })
    expect(view.actions.map(a => a.id)).toEqual(['vote'])
    const b0 = await bal(buyer); const s0 = await bal(seller)
    actAs('validator'); await v2.vote(jobId, 3000, hashText('reasoning'))
    b = await bundle(jobId)
    expect(b.job.status).toBe(JobStatus.Split)
    expect((await bal(buyer)) - b0).toBe(parseUsdc('70'))
    expect((await bal(seller)) - s0).toBe(parseUsdc('29.7')) // 30 minus 1% fee on the provider share
  })

  it('buyer or seller cannot vote on their own dispute', async () => {
    const validator = acct('validator').address
    const { jobId } = await hireFlow('10', baseCfg({ mode: 1, validators: [validator] }))
    await submit(jobId)
    actAs('buyer'); await v2.rejectWork(jobId, hashText('r'), hashText('e'))
    actAs('seller'); await v2.contest(jobId, hashText('e2'))
    await expect(v2.vote(jobId, 10000, hashText('x'))).rejects.toBeTruthy()
  })

  it('no submission: buyer reclaims after the deadline, not before', async () => {
    const { jobId, buyer } = await hireFlow('25', baseCfg(), 2)
    actAs('buyer')
    await expect(v2.claimRefund(jobId)).rejects.toBeTruthy()
    await warp(2 * DAY + 10)
    const b0 = await bal(buyer)
    await v2.claimRefund(jobId)
    expect((await bal(buyer)) - b0).toBe(parseUsdc('25'))
    expect((await bundle(jobId)).job.status).toBe(JobStatus.Expired)
  })

  it('hire resumes after a mid-flow failure without creating a second job', async () => {
    const buyer = actAs('buyer')
    const now = await chainNow()
    await v2.createListing({ title: 'Resume', description: 'Resume test', maxBudget: '500', biddingEnds: BigInt(now + 7 * DAY), invitee: '' })
    const listingId = (await v2.readParams()).listingCount
    actAs('seller')
    await v2.placeBid({ listingId, price: '12', config: baseCfg(), validUntil: BigInt(now + 5 * DAY), proposal: '' })
    actAs('buyer')
    const listing = (await v2.getListing(listingId))!
    const bid = (await v2.getBids(listing))[0]!
    const before = await pc.readContract({ address: dep.kernel as Address, abi: kernelAbi, functionName: 'jobCount' })
    await expect(v2.runHire({ listing, bid, deadlineDays: 7, onStep: (id, st) => { if (id === 'configure' && st === 'start') throw new Error('simulated reload') } })).rejects.toThrow('simulated reload')
    expect(await pc.readContract({ address: dep.kernel as Address, abi: kernelAbi, functionName: 'jobCount' })).toBe(before + 1n)
    const { jobId } = await v2.runHire({ listing, bid, deadlineDays: 7, onStep: noop })
    expect(await pc.readContract({ address: dep.kernel as Address, abi: kernelAbi, functionName: 'jobCount' })).toBe(before + 1n)
    expect((await bundle(jobId, buyer)).job.status).toBe(JobStatus.Funded)
  })

  it('refuses to hire a bid whose terms do not match its onchain hash', async () => {
    actAs('buyer')
    const now = await chainNow()
    await v2.createListing({ title: 'Tamper', description: 'Tamper test', maxBudget: '500', biddingEnds: BigInt(now + 7 * DAY), invitee: '' })
    const listingId = (await v2.readParams()).listingCount
    actAs('seller')
    await v2.placeBid({ listingId, price: '12', config: baseCfg(), validUntil: BigInt(now + 5 * DAY), proposal: '' })
    actAs('buyer')
    const listing = (await v2.getListing(listingId))!
    const bid = (await v2.getBids(listing))[0]!
    const tampered = { ...bid, config: { ...bid.config!, timeoutProviderBps: 10000 }, configVerified: false }
    await expect(v2.runHire({ listing, bid: tampered, deadlineDays: 7, onStep: noop })).rejects.toThrow(/could not be verified/)
  })

  it('rejects bids outside launch limits before sending', async () => {
    actAs('buyer')
    const now = await chainNow()
    await v2.createListing({ title: 'Limits', description: 'Limits test', maxBudget: '900', biddingEnds: BigInt(now + 7 * DAY), invitee: '' })
    const listingId = (await v2.readParams()).listingCount
    actAs('seller')
    await expect(v2.placeBid({ listingId, price: '0.001', config: baseCfg(), validUntil: BigInt(now + DAY), proposal: '' })).rejects.toThrow(/below the platform minimum/)
    await expect(v2.placeBid({ listingId, price: '5000', config: baseCfg(), validUntil: BigInt(now + DAY), proposal: '' })).rejects.toThrow(/above the current launch maximum/)
  })

  it('hosts a dispute file: authorised party only, hash-checked, listed back, matches the onchain record', async () => {
    const validator = acct('validator').address
    const { jobId } = await hireFlow('10', baseCfg({ mode: 1, validators: [validator] }))
    await submit(jobId)
    const evidence = new TextEncoder().encode('screenshot bytes')
    actAs('buyer')
    const up = await v2.hostFile({ jobId, kind: 'evidence', bytes: evidence, name: 'proof.txt' })
    expect(up.url).toContain(`/v2/${jobId}/evidence/`)
    expect(up.hash).toBe(keccak256(evidence))
    await v2.rejectWork(jobId, hashText('reason'), up.hash)
    actAs('stranger')
    await expect(v2.hostFile({ jobId, kind: 'evidence', bytes: evidence, name: 'x.txt' })).rejects.toThrow(/Only the buyer, seller or a decider/)
    const files = await v2.listFiles(jobId)
    expect(files.configured).toBe(true)
    expect(files.files.map(f => f.keccak)).toContain(up.hash.toLowerCase())
    const record = await v2.getDisputeRecord(jobId)
    expect(record.map(r => r.hash)).toContain(up.hash)
    expect(record.some(r => r.kind === 'reason' && r.hash === hashText('reason'))).toBe(true)
  })

  it('finds jobs by buyer and seller without an indexer', async () => {
    const buyer = actAs('buyer')
    const mine = await v2.getMyJobs(buyer)
    expect(mine.length).toBeGreaterThan(5)
    expect(mine.every(j => j.role === 'buyer')).toBe(true)
    const seller = actAs('seller')
    const sj = await v2.getMyJobs(seller)
    expect(sj.length).toBeGreaterThan(3)
  })

  it('dashboard lists my listings, bids and shows no claimable', async () => {
    const me = actAs('buyer')
    const d = await v2.getDashboard(me)
    expect(d.listings.length).toBeGreaterThan(3)
    expect(d.claimable).toBe(0n)
    const s = actAs('seller')
    const ds = await v2.getDashboard(s)
    expect(ds.bids.length).toBeGreaterThan(3)
  })
})
