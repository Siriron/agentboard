import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toHex, type Address } from 'viem'
import { getDashboard, withdrawClaimable, ListingStatus } from '../../protocol/v2'
import { formatUsdc } from '../../protocol/units'
import { Empty, ErrorBox, Loading, Page, RealFundsBanner, TxStatus, useAction, useV2Wallet } from '../ui'

export default function V2Dashboard() {
  const w = useV2Wallet()
  const qc = useQueryClient()
  const me = w.account as Address | null
  const q = useQuery({ queryKey: ['v2', 'dash', me], enabled: !!me, queryFn: () => getDashboard(me as Address) })
  const act = useAction(() => qc.invalidateQueries({ queryKey: ['v2', 'dash'] }))
  if (!me) return <Page><Empty><button className="btn btn-primary" onClick={() => w.openPicker()}>Connect wallet</button></Empty></Page>
  return (
    <Page narrow>
      <RealFundsBanner />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 16 }}>My activity</h1>
      {q.isPending && <Loading what="your activity" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {q.data && (
        <div style={{ display: 'grid', gap: 18 }}>
          {q.data.claimable > 0n && (
            <div className="card" style={{ padding: 16 }}>
              <strong>{formatUsdc(q.data.claimable)} USDC waiting to withdraw</strong>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '6px 0' }}>A payout could not be sent directly (for example a blocklisted or non-receiving address) and was held for you.</p>
              <button className="btn btn-primary btn-sm" disabled={!!act.busy} onClick={() => act.run('claim', () => withdrawClaimable(me))}>Withdraw to this wallet</button>
              <TxStatus error={act.error} hash={act.hash} />
            </div>
          )}
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>My listings</h2>
            {q.data.listings.length === 0 && <Empty>No listings yet.</Empty>}
            {q.data.listings.map(l => (
              <Link key={String(l.id)} to={l.status === ListingStatus.Filled ? `/job/${toHex(l.jobId, { size: 32 })}` : `/listing/${l.id}`} className="card" style={{ display: 'block', padding: 14, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
                {l.meta?.title ?? `Listing #${l.id}`} · {['', 'Open', 'Hired', 'Cancelled'][l.status]} · {l.bidCount} bid(s)
              </Link>
            ))}
          </section>
          <section>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>My bids</h2>
            {q.data.bids.length === 0 && <Empty>No bids found in recent listings.</Empty>}
            {q.data.bids.map(({ listing, bid }) => (
              <Link key={`${listing.id}-${bid.id}`} to={bid.status === 3 ? `/job/${toHex(listing.jobId, { size: 32 })}` : `/listing/${listing.id}`} className="card" style={{ display: 'block', padding: 14, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
                {listing.meta?.title ?? `Listing #${listing.id}`} · {formatUsdc(bid.price)} USDC · {['', 'Active', 'Withdrawn', 'Hired'][bid.status]}
              </Link>
            ))}
          </section>
          <small style={{ color: 'var(--text-3)' }}>Shows activity in the most recent 100 listings. Jobs created directly on the kernel are not listed; open them by link.</small>
        </div>
      )}
    </Page>
  )
}
