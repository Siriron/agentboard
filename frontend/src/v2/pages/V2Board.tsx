import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listListings, ListingStatus } from '../../protocol/v2'
import { CATEGORIES } from '../../protocol/categories'
import { formatUsdc } from '../../protocol/units'
import { DEFAULT_FILTER, filterListings, type BoardFilter } from '../boardFilter'
import { Empty, ErrorBox, Loading, Page, PageHead, RealFundsBanner, short } from '../ui'

const LABEL = ['—', 'Open', 'Hired', 'Cancelled']
const STATUSES: Array<[BoardFilter['status'], string]> = [['open', 'Open'], ['hired', 'Hired'], ['cancelled', 'Cancelled'], ['all', 'All']]
const ZERO = '0x0000000000000000000000000000000000000000'

export default function V2Board() {
  const q = useQuery({ queryKey: ['v2', 'listings'], queryFn: () => listListings(100), refetchInterval: 30_000 })
  const [f, setF] = useState<BoardFilter>(DEFAULT_FILTER)
  const set = (p: Partial<BoardFilter>) => setF(prev => ({ ...prev, ...p }))
  const shown = q.data ? filterListings(q.data, f) : []
  const openCount = q.data?.filter(l => l.status === ListingStatus.Open).length ?? 0
  const counts = (c: string) => q.data ? q.data.filter(l => (c === 'All' || (l.meta?.category ?? 'Other') === c) && (f.status === 'all' || l.status === { open: ListingStatus.Open, hired: ListingStatus.Filled, cancelled: ListingStatus.Cancelled }[f.status])).length : 0
  return (
    <Page>
      <RealFundsBanner />
      <PageHead title="Job board" lede={q.data ? `${openCount} open of ${q.data.length}${q.data.length >= 100 ? '+' : ''} listings. Refreshes every 30 seconds.` : 'Open listings on Arc Mainnet.'}>
        <button className="btn btn-secondary btn-sm" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? 'Refreshing…' : 'Refresh'}</button>
        <Link to="/post" className="btn btn-primary btn-sm">Post a listing</Link>
      </PageHead>

      <div className="board-layout">
        <aside className="board-filters" aria-label="Filters">
          <label className="input-label" htmlFor="bq">Search</label>
          <input id="bq" className="input" type="search" value={f.q} onChange={e => set({ q: e.target.value })} placeholder="Title, text or #id" autoComplete="off" />
          <div className="bf-group">
            <span className="input-label">Status</span>
            <div className="seg" role="radiogroup" aria-label="Status">
              {STATUSES.map(([v, l]) => <button key={v} role="radio" aria-checked={f.status === v} onClick={() => set({ status: v })}>{l}</button>)}
            </div>
          </div>
          <div className="bf-group">
            <label className="input-label" htmlFor="bs">Sort</label>
            <select id="bs" className="input" value={f.sort} onChange={e => set({ sort: e.target.value as BoardFilter['sort'] })}><option value="newest">Newest</option><option value="budget">Highest budget</option></select>
          </div>
          <div className="bf-group">
            <span className="input-label">Category</span>
            <div className="cat-list" role="group" aria-label="Category">
              {['All', ...CATEGORIES].map(c => (
                <button key={c} aria-pressed={f.category === c} onClick={() => set({ category: c })}><span>{c}</span><span className="num">{counts(c)}</span></button>
              ))}
            </div>
          </div>
        </aside>

        <section aria-label="Listings" aria-live="polite">
          {q.isPending && <Loading what="listings" />}
          {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
          {q.data && shown.length === 0 && <Empty title={q.data.length === 0 ? 'No listings yet' : 'Nothing matches'} expression={q.data.length === 0 ? 'prompt' : 'curious'}>{q.data.length === 0 ? <>Be the first to <Link to="/post" style={{ textDecoration: 'underline' }}>post a listing</Link>.</> : 'Try another category or status, or clear the search.'}</Empty>}
          <div style={{ display: 'grid', gap: 10 }}>
            {shown.map(l => (
              <Link key={String(l.id)} to={`/listing/${l.id}`} className="card is-link listing-row">
                <div style={{ minWidth: 0 }}>
                  <div className="lr-title">{l.meta?.title ?? `Listing #${l.id}`}</div>
                  <div className="lr-meta">{l.meta?.category ?? 'Other'} · {l.bidCount} bid{l.bidCount === 1 ? '' : 's'} · by {short(l.client)}{l.invitee !== ZERO && ' · invite only'}</div>
                </div>
                <div className="lr-side">
                  <div className="num lr-budget">{formatUsdc(l.maxBudget)}<small> USDC</small></div>
                  <span className={`badge ${l.status === ListingStatus.Open ? 'badge-open' : l.status === ListingStatus.Cancelled ? 'badge-cancelled' : 'badge-hired'}`}>{LABEL[l.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Page>
  )
}
