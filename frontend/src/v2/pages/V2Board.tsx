import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listListings, ListingStatus } from '../../protocol/v2'
import { formatUsdc } from '../../protocol/units'
import { Empty, ErrorBox, Loading, Page, RealFundsBanner, short } from '../ui'

const LABEL = ['—', 'Open', 'Hired', 'Cancelled']

export default function V2Board() {
  const q = useQuery({ queryKey: ['v2', 'listings'], queryFn: () => listListings(60), refetchInterval: 30_000 })
  return (
    <Page>
      <RealFundsBanner />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Job board</h1>
        <Link to="/post" className="btn btn-primary btn-sm">Post a listing</Link>
      </div>
      {q.isPending && <Loading what="listings" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty>No listings yet. Be the first to post one.</Empty>}
      <div style={{ display: 'grid', gap: 12 }}>
        {q.data?.map(l => (
          <Link key={String(l.id)} to={`/listing/${l.id}`} className="card" style={{ padding: 18, textDecoration: 'none', color: 'inherit', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ fontSize: 16 }}>{l.meta?.title ?? `Listing #${l.id}`}</strong>
              <span className={`badge ${l.status === ListingStatus.Open ? 'badge-open' : 'badge-hired'}`}>{LABEL[l.status]}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              Up to <strong>{formatUsdc(l.maxBudget)} USDC</strong> · {l.bidCount} bid{l.bidCount === 1 ? '' : 's'} · by {short(l.client)}
              {l.invitee !== '0x0000000000000000000000000000000000000000' && ' · invite only'}
            </div>
          </Link>
        ))}
      </div>
    </Page>
  )
}
