import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toHex, type Address } from 'viem'
import {
  BidStatus, cancelListing, getBids, getListing, HIRE_STEPS, ListingStatus, placeBid, readParams, runHire, withdrawBid,
  type Bid, type EvalConfig, type HireStep, type Listing, type Params,
} from '../../protocol/v2'
import { formatUsdc, splitFee } from '../../protocol/units'
import { ConfirmDialog, useV2Wallet, Empty, ErrorBox, Loading, Page, RealFundsBanner, short, TxStatus, useAction, useNow } from '../ui'

const DAY = 86400
const MODE = ['Buyer decides, arbitrator settles disputes', 'One named validator settles disputes', 'Panel of validators settles disputes (median)']

export default function V2Listing() {
  const { id } = useParams()
  const w = useV2Wallet()
  const now = useNow(30_000)
  let lid: bigint | null = null
  try { lid = BigInt(id ?? '') } catch { lid = null }
  const q = useQuery({
    queryKey: ['v2', 'listing', String(lid)], enabled: lid !== null,
    queryFn: async () => { const listing = await getListing(lid as bigint); return listing ? { listing, bids: await getBids(listing) } : null },
  })
  const params = useQuery({ queryKey: ['v2', 'params'], queryFn: readParams })
  if (lid === null) return <Page><Empty>That listing id is not valid.</Empty></Page>
  if (q.isPending) return <Page><Loading what="listing" /></Page>
  if (q.isError) return <Page><ErrorBox error={q.error} retry={() => q.refetch()} /></Page>
  if (!q.data) return <Page><Empty>Listing #{id} does not exist.</Empty></Page>
  const { listing, bids } = q.data
  const me = w.account?.toLowerCase() ?? null
  const isOwner = me === listing.client.toLowerCase()
  const open = listing.status === ListingStatus.Open
  const biddingClosed = listing.biddingEnds !== 0n && BigInt(now) > listing.biddingEnds

  return (
    <Page narrow>
      <RealFundsBanner />
      <Link to="/board" style={{ fontSize: 13, color: 'var(--text-2)' }}>← Board</Link>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: '8px 0' }}>{listing.meta?.title ?? `Listing #${listing.id}`}</h1>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
        Up to <strong>{formatUsdc(listing.maxBudget)} USDC</strong> · posted by {short(listing.client)}
        {listing.biddingEnds !== 0n && <> · bidding {biddingClosed ? 'closed' : 'closes'} {new Date(Number(listing.biddingEnds) * 1000).toLocaleDateString()}</>}
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Acceptance criteria</h2>
        {/* Rendered as plain text, never as HTML. */}
        <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{listing.meta?.description ?? 'The description is not stored onchain for this listing. Only its hash is.'}</p>
        <small style={{ color: listing.specMatches === false ? 'var(--red)' : 'var(--text-3)' }}>
          {listing.specMatches === true ? 'Matches the onchain hash.' : listing.specMatches === false ? 'Does NOT match the onchain hash. Do not trust this text.' : `Onchain hash ${listing.specHash.slice(0, 12)}…`}
        </small>
      </div>
      {listing.status === ListingStatus.Filled && <Link className="btn btn-primary" to={`/job/${toHex(listing.jobId, { size: 32 })}`}>Open the funded job</Link>}
      {listing.status === ListingStatus.Cancelled && <Empty>This listing was cancelled.</Empty>}
      {isOwner && open && <OwnerTools listing={listing} onDone={() => q.refetch()} />}

      <h2 style={{ fontSize: 16, margin: '22px 0 10px' }}>Bids ({bids.length})</h2>
      {bids.length === 0 && <Empty>No bids yet.</Empty>}
      <div style={{ display: 'grid', gap: 12 }}>
        {bids.map(b => <BidCard key={b.id} bid={b} listing={listing} params={params.data} now={now} isOwner={isOwner} me={me} onDone={() => q.refetch()} />)}
      </div>

      {open && !isOwner && !biddingClosed && (
        !w.account ? <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => w.openPicker()}>Connect wallet to bid</button>
          : w.wrongChain ? <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>
          : <BidForm listing={listing} params={params.data} onDone={() => q.refetch()} />
      )}
    </Page>
  )
}

function OwnerTools({ listing, onDone }: { listing: Listing; onDone: () => void }) {
  const qc = useQueryClient()
  const act = useAction(() => { qc.invalidateQueries({ queryKey: ['v2', 'listings'] }); onDone() })
  return (
    <div style={{ margin: '12px 0' }}>
      <button className="btn btn-secondary btn-sm" disabled={!!act.busy} onClick={() => act.run('cancel', () => cancelListing(listing.id))}>Cancel listing</button>
      <TxStatus error={act.error} hash={act.hash} />
    </div>
  )
}

function BidCard({ bid, listing, params, now, isOwner, me, onDone }: { bid: Bid; listing: Listing; params?: Params; now: number; isOwner: boolean; me: string | null; onDone: () => void }) {
  const nav = useNavigate()
  const act = useAction(onDone)
  const [confirm, setConfirm] = useState(false)
  const [days, setDays] = useState('14')
  const [steps, setSteps] = useState<Partial<Record<HireStep['id'], 'start' | 'done'>>>({})
  const expired = BigInt(now) > bid.validUntil
  const active = bid.status === BidStatus.Active && !expired
  const mine = me === bid.provider.toLowerCase()
  const feeBps = params?.feeBps ?? 100
  const { fee, net } = splitFee(bid.price, feeBps)
  const outOfLimits = !!params && (bid.price < params.minBudget || bid.price > params.maxBudget)
  const label = ['—', expired ? 'Expired' : 'Active', 'Withdrawn', 'Hired'][bid.status]
  const d = Number(days)

  async function hire() {
    setConfirm(false); setSteps({})
    await act.run('hire', async () => {
      const r = await runHire({ listing, bid, deadlineDays: d, onStep: (s, st) => setSteps(p => ({ ...p, [s]: st })) })
      nav(`/job/${toHex(r.jobId, { size: 32 })}`)
      return { hash: r.hash }
    })
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{formatUsdc(bid.price)} USDC</strong><span className="badge">{label}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>by {short(bid.provider)}{mine && ' (you)'} · valid until {new Date(Number(bid.validUntil) * 1000).toLocaleDateString()}</div>
      {bid.proposal && <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{bid.proposal}</p>}
      {bid.config ? <TermsSummary c={bid.config} /> : <div style={{ fontSize: 13, color: 'var(--red)' }}>Evaluation terms could not be verified against the bid&apos;s onchain hash. Hiring is disabled.</div>}
      {outOfLimits && active && <div style={{ fontSize: 13, color: 'var(--red)' }}>This price is outside the current launch limits ({formatUsdc(params!.minBudget)} to {formatUsdc(params!.maxBudget)} USDC), so it cannot be funded.</div>}
      {isOwner && active && listing.status === ListingStatus.Open && bid.configVerified && !outOfLimits && (
        <>
          <label style={{ fontSize: 13 }}>Seller deadline (days from now)
            <input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" style={{ marginLeft: 8, width: 60, padding: 4 }} />
          </label>
          <button className="btn btn-primary" disabled={!!act.busy || !(d >= 1 && d <= 180)} onClick={() => setConfirm(true)}>{act.busy ? 'Working…' : `Hire and fund ${formatUsdc(bid.price)} USDC`}</button>
        </>
      )}
      {act.busy === 'hire' && (
        <ol style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
          {HIRE_STEPS.map(s => <li key={s.id} style={{ color: steps[s.id] === 'done' ? 'var(--green)' : 'var(--text-2)' }}>{s.label}{steps[s.id] === 'start' ? ' (confirm in wallet)' : steps[s.id] === 'done' ? ' ✓' : ''}</li>)}
        </ol>
      )}
      {mine && active && <button className="btn btn-secondary btn-sm" disabled={!!act.busy} onClick={() => act.run('withdraw', () => withdrawBid(bid.listingId, bid.id))}>Withdraw bid</button>}
      <TxStatus error={act.error} hash={act.hash} />
      {confirm && (
        <ConfirmDialog title="Hire and fund escrow" amount={bid.price} confirmLabel="Fund escrow" onCancel={() => setConfirm(false)} onConfirm={hire}
          lines={[
            <>You pay <strong>{formatUsdc(bid.price)} USDC</strong> into escrow. That is the full amount; no fee is added on top.</>,
            <>When paid out, the {feeBps / 100}% platform fee ({formatUsdc(fee)} USDC) comes out of the seller&apos;s side: the seller receives {formatUsdc(net)} USDC.</>,
            'The funds are held by the contract. The platform cannot move them, invest them, or lend them.',
            'This takes up to 5 wallet confirmations (allowance, create, terms, price, fund). If one fails, retry and it resumes where it stopped.',
          ]} />
      )}
    </div>
  )
}

function TermsSummary({ c }: { c: EvalConfig }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
      <div>{MODE[c.mode]}</div>
      <div>Buyer review {c.reviewWindow / DAY}d · seller response {c.responseWindow / DAY}d · decision {c.decisionWindow / DAY}d · if deciders stay silent, seller gets {c.timeoutProviderBps / 100}%</div>
      {c.validators.length > 0 && <div>Validators: {c.validators.map(short).join(', ')}</div>}
    </div>
  )
}

function BidForm({ listing, params, onDone }: { listing: Listing; params?: Params; onDone: () => void }) {
  const act = useAction(onDone)
  const [f, setF] = useState({ price: '', proposal: '', validDays: '7', mode: '0', review: '3', response: '3', decision: '7', timeout: '50', validators: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))
  const field = { display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid var(--border)', font: 'inherit' } as const
  async function submit() {
    await act.run('bid', async () => {
      const validators = f.validators.split(/[\s,]+/).filter(Boolean) as Address[]
      const config: EvalConfig = {
        mode: Number(f.mode) as 0 | 1 | 2, reviewWindow: Number(f.review) * DAY, responseWindow: Number(f.response) * DAY,
        decisionWindow: Number(f.decision) * DAY, timeoutProviderBps: Math.round(Number(f.timeout) * 100), validators,
      }
      return placeBid({ listingId: listing.id, price: f.price, config, validUntil: BigInt(Math.floor(Date.now() / 1000) + Number(f.validDays) * DAY), proposal: f.proposal })
    })
  }
  return (
    <div className="card" style={{ padding: 18, marginTop: 20, display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 16 }}>Place a bid</h2>
      <label>Your price (USDC, max {formatUsdc(listing.maxBudget)}){params && <small style={{ color: 'var(--text-3)' }}> · min {formatUsdc(params.minBudget)}</small>}<input value={f.price} onChange={set('price')} inputMode="decimal" style={field} /></label>
      <label>Proposal<textarea value={f.proposal} onChange={set('proposal')} rows={3} maxLength={2000} style={field} /></label>
      <label>Bid valid for (days)<input value={f.validDays} onChange={set('validDays')} inputMode="numeric" style={field} /></label>
      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
        <legend style={{ fontSize: 13 }}>Evaluation terms you accept (hashed into your bid)</legend>
        <label>Who settles disputes
          <select value={f.mode} onChange={set('mode')} style={field}>{MODE.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        </label>
        {f.mode !== '0' && <label>Validator address(es), comma separated ({f.mode === '1' ? '1' : '3 or 5'})<input value={f.validators} onChange={set('validators')} style={field} /></label>}
        <label>Buyer review window (1 to 7 days)<input value={f.review} onChange={set('review')} inputMode="numeric" style={field} /></label>
        <label>Seller response window (1 to 7 days)<input value={f.response} onChange={set('response')} inputMode="numeric" style={field} /></label>
        <label>Decision window (1 to 14 days, not shorter than response)<input value={f.decision} onChange={set('decision')} inputMode="numeric" style={field} /></label>
        <label>If deciders stay silent, seller receives (% of budget)<input value={f.timeout} onChange={set('timeout')} inputMode="decimal" style={field} /></label>
      </fieldset>
      <small style={{ color: 'var(--text-3)' }}>The minimum for every window is 1 day, so disputes take at least a day to resolve on mainnet.</small>
      <button className="btn btn-primary" disabled={!f.price || !!act.busy} onClick={submit}>{act.busy ? 'Waiting for wallet…' : 'Place bid'}</button>
      <TxStatus error={act.error} hash={act.hash} />
    </div>
  )
}
