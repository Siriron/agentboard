import { ListingStatus, type Listing } from '../protocol/v2core'

export interface BoardFilter { q: string; category: string; status: 'all' | 'open' | 'hired' | 'cancelled'; sort: 'newest' | 'budget' }
export const DEFAULT_FILTER: BoardFilter = { q: '', category: 'All', status: 'open', sort: 'newest' }

const STATUS_OF = { open: ListingStatus.Open, hired: ListingStatus.Filled, cancelled: ListingStatus.Cancelled } as const

export function filterListings(all: Listing[], f: BoardFilter): Listing[] {
  const q = f.q.trim().toLowerCase()
  const out = all.filter(l => {
    if (f.status !== 'all' && l.status !== STATUS_OF[f.status]) return false
    if (f.category !== 'All' && (l.meta?.category ?? 'Other') !== f.category) return false
    if (q && !`${l.meta?.title ?? ''} ${l.meta?.description ?? ''} #${l.id}`.toLowerCase().includes(q)) return false
    return true
  })
  return out.sort((a, b) => (f.sort === 'budget' ? (a.maxBudget === b.maxBudget ? 0 : a.maxBudget < b.maxBudget ? 1 : -1) : (a.id === b.id ? 0 : a.id < b.id ? 1 : -1)))
}
