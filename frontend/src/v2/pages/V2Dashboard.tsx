import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toHex, type Address } from 'viem'
import { getDashboard, withdrawClaimable, ListingStatus } from '../../protocol/v2'
import { STATUS_LABEL } from '../../protocol/state'
import { formatUsdc } from '../../protocol/units'
import { Empty, ErrorBox, Loading, Page, PageHead, RealFundsBanner, TxStatus, useAction, useV2Wallet } from '../ui'

const jobBadge = (s: number) => (s === 4 ? 'badge-validated' : s === 3 ? 'badge-submitted' : s === 1 || s === 2 ? 'badge-hired' : 'badge-cancelled')

function Row({ to, title, meta, badge, badgeClass }: { to: string; title: string; meta: string; badge: string; badgeClass: string }) {
  return (
    <Link to={to} className="card is-link dash-row">
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</div><div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{meta}</div></div>
      <span className={`badge ${badgeClass}`}>{badge}</span>
    </Link>
  )
}

export default function V2Dashboard() {
  const w = useV2Wallet()
  const qc = useQueryClient()
  const me = w.account as Address | null
  const q = useQuery({ queryKey: ['v2', 'dash', me], enabled: !!me, queryFn: () => getDashboard(me as Address) })
  const act = useAction(() => qc.invalidateQueries({ queryKey: ['v2', 'dash'] }))
  if (!me) return (
    <Page narrow><RealFundsBanner />
      <Empty title="Connect to see your activity" expression="prompt"><p style={{ marginBottom: 12 }}>Your jobs, listings and bids are read from the chain for the connected wallet.</p><button className="btn btn-primary" onClick={() => w.openPicker()}>Connect wallet</button></Empty>
    </Page>
  )
  const d = q.data
  return (
    <Page>
      <RealFundsBanner />
      <PageHead title="My activity" lede="Everything tied to this wallet, read from the chain." />
      {q.isPending && <Loading what="your activity" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {d && (
        <div style={{ display: 'grid', gap: 28 }}>
          <dl className="stat-strip">
            {[['Jobs', d.jobs.length], ['Listings', d.listings.length], ['Bids', d.bids.length]].map(([k, v]) => <div key={String(k)}><dt>{k}</dt><dd className="num">{String(v)}</dd></div>)}
            <div><dt>To withdraw</dt><dd className="num">{formatUsdc(d.claimable)} <small>USDC</small></dd></div>
          </dl>
          {d.claimable > 0n && (
            <div className="card" style={{ padding: 18, borderColor: 'var(--amber)' }}>
              <strong>{formatUsdc(d.claimable)} USDC waiting to withdraw</strong>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 12px' }}>A payout could not be sent directly (for example a blocklisted or non-receiving address) and was held for you.</p>
              <button className="btn btn-primary btn-sm" disabled={!!act.busy} onClick={() => act.run('claim', () => withdrawClaimable(me))}>Withdraw to this wallet</button>
              <TxStatus error={act.error} hash={act.hash} />
            </div>
          )}
          <div className="dash-grid">
            <section aria-labelledby="jobs-h">
              <h2 id="jobs-h" className="dash-h">Jobs</h2>
              {d.jobs.length === 0 && <Empty expression="idle">No jobs yet. Hire a bid on a listing, or win one, and it shows up here.</Empty>}
              <div style={{ display: 'grid', gap: 8 }}>
                {d.jobs.map(j => <Row key={String(j.jobId)} to={`/job/${toHex(j.jobId, { size: 32 })}`} title={`Job #${j.number}`} meta={`${j.role === 'buyer' ? 'You are the buyer' : 'You are the seller'} · ${formatUsdc(j.budget)} USDC`} badge={STATUS_LABEL[j.status]} badgeClass={jobBadge(j.status)} />)}
              </div>
            </section>
            <div style={{ display: 'grid', gap: 28, alignContent: 'start' }}>
              <section aria-labelledby="listings-h">
                <h2 id="listings-h" className="dash-h">Listings</h2>
                {d.listings.length === 0 && <Empty expression="prompt">You have not posted a listing.</Empty>}
                <div style={{ display: 'grid', gap: 8 }}>
                  {d.listings.map(l => <Row key={String(l.id)} to={l.status === ListingStatus.Filled ? `/job/${toHex(l.jobId, { size: 32 })}` : `/listing/${l.id}`} title={l.meta?.title ?? `Listing #${l.id}`} meta={`${l.bidCount} bid${l.bidCount === 1 ? '' : 's'}`} badge={['', 'Open', 'Hired', 'Cancelled'][l.status]} badgeClass={l.status === ListingStatus.Open ? 'badge-open' : l.status === ListingStatus.Filled ? 'badge-hired' : 'badge-cancelled'} />)}
                </div>
              </section>
              <section aria-labelledby="bids-h">
                <h2 id="bids-h" className="dash-h">Bids</h2>
                {d.bids.length === 0 && <Empty expression="curious">No bids found in recent listings.</Empty>}
                <div style={{ display: 'grid', gap: 8 }}>
                  {d.bids.map(({ listing, bid }) => <Row key={`${listing.id}-${bid.id}`} to={bid.status === 3 ? `/job/${toHex(listing.jobId, { size: 32 })}` : `/listing/${listing.id}`} title={listing.meta?.title ?? `Listing #${listing.id}`} meta={`${formatUsdc(bid.price)} USDC`} badge={['', 'Active', 'Withdrawn', 'Hired'][bid.status]} badgeClass={bid.status === 1 ? 'badge-open' : bid.status === 3 ? 'badge-hired' : 'badge-cancelled'} />)}
                </div>
              </section>
            </div>
          </div>
          <small style={{ color: 'var(--text-3)' }}>Listings and bids cover the most recent 100 listings. Jobs are found from chain events, including jobs created directly on the kernel.</small>
        </div>
      )}
    </Page>
  )
}
