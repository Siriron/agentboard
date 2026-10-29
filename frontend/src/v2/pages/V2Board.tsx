import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listListings, ListingStatus } from '../../protocol/v2'
import { CATEGORIES } from '../../protocol/categories'
import { formatUsdc } from '../../protocol/units'
import { DEFAULT_FILTER, filterListings, type BoardFilter } from '../boardFilter'
import { Empty, ErrorBox, Loading, Page, RealFundsBanner, short } from '../ui'

const LABEL = ['—', 'Open', 'Hired', 'Cancelled']
const chip = (on: boolean) => ({ padding: '6px 12px', borderRadius: 99, border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--border)'), background: on ? 'var(--accent-dim)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' } as const)
const ctl = { padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', font: 'inherit', fontSize: 14, background: '#fff' } as const

export default function V2Board() {
  const q = useQuery({ queryKey: ['v2', 'listings'], queryFn: () => listListings(100), refetchInterval: 30_000 })
  const [f, setF] = useState<BoardFilter>(DEFAULT_FILTER)
  const set = (p: Partial<BoardFilter>) => setF(prev => ({ ...prev, ...p }))
  const shown = q.data ? filterListings(q.data, f) : []
  const openCount = q.data?.filter(l => l.status === ListingStatus.Open).length ?? 0
  return (
    <Page>
      <RealFundsBanner />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Job board</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? 'Refreshing…' : 'Refresh'}</button>
          <Link to="/post" className="btn btn-primary btn-sm">Post a listing</Link>
        </div>
      </div>
      {q.data && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{openCount} open · {q.data.length} total{q.data.length >= 100 ? ' (latest 100)' : ''}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={f.q} onChange={e => set({ q: e.target.value })} placeholder="Search listings" aria-label="Search listings" style={{ ...ctl, flex: '1 1 200px', minWidth: 0 }} />
        <select value={f.status} onChange={e => set({ status: e.target.value as BoardFilter['status'] })} aria-label="Status" style={ctl}>
          <option value="open">Open</option><option value="hired">Hired</option><option value="cancelled">Cancelled</option><option value="all">All statuses</option>
        </select>
        <select value={f.sort} onChange={e => set({ sort: e.target.value as BoardFilter['sort'] })} aria-label="Sort" style={ctl}>
          <option value="newest">Newest</option><option value="budget">Highest budget</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }} role="group" aria-label="Category">
        {['All', ...CATEGORIES].map(c => <button key={c} style={chip(f.category === c)} aria-pressed={f.category === c} onClick={() => set({ category: c })}>{c}</button>)}
      </div>
      {q.isPending && <Loading what="listings" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {q.data && shown.length === 0 && <Empty>{q.data.length === 0 ? 'No listings yet. Be the first to post one.' : 'No listings match these filters.'}</Empty>}
      <div style={{ display: 'grid', gap: 12 }}>
        {shown.map(l => (
          <Link key={String(l.id)} to={`/listing/${l.id}`} className="card" style={{ padding: 18, textDecoration: 'none', color: 'inherit', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ fontSize: 16, minWidth: 0, overflowWrap: 'anywhere' }}>{l.meta?.title ?? `Listing #${l.id}`}</strong>
              <span className={`badge ${l.status === ListingStatus.Open ? 'badge-open' : l.status === ListingStatus.Cancelled ? 'badge-cancelled' : 'badge-hired'}`}>{LABEL[l.status]}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {l.meta?.category ?? 'Other'} · Up to <strong>{formatUsdc(l.maxBudget)} USDC</strong> · {l.bidCount} bid{l.bidCount === 1 ? '' : 's'} · by {short(l.client)}
              {l.invitee !== '0x0000000000000000000000000000000000000000' && ' · invite only'}
            </div>
          </Link>
        ))}
      </div>
    </Page>
  )
}
