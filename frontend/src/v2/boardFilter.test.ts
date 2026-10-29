import { describe, expect, it } from 'vitest'
import { ListingStatus, type Listing } from '../protocol/v2core'
import { DEFAULT_FILTER, filterListings } from './boardFilter'

const L = (id: number, status: number, maxBudget: bigint, title: string, category?: string) =>
  ({ id: BigInt(id), status, maxBudget, bidCount: 0, meta: { title, description: '', category } }) as unknown as Listing
const data = [L(1, ListingStatus.Open, 5n, 'Audit my vault', 'Audit'), L(2, ListingStatus.Filled, 50n, 'Landing page', 'Frontend'), L(3, ListingStatus.Open, 20n, 'Old listing'), L(4, ListingStatus.Cancelled, 1n, 'Gone', 'Data')]

describe('filterListings', () => {
  it('defaults to open, newest first', () => { expect(filterListings(data, DEFAULT_FILTER).map(l => Number(l.id))).toEqual([3, 1]) })
  it('filters by category, treating missing as Other', () => {
    expect(filterListings(data, { ...DEFAULT_FILTER, category: 'Audit' }).map(l => Number(l.id))).toEqual([1])
    expect(filterListings(data, { ...DEFAULT_FILTER, category: 'Other' }).map(l => Number(l.id))).toEqual([3])
  })
  it('searches title and id, and sorts by budget', () => {
    expect(filterListings(data, { ...DEFAULT_FILTER, status: 'all', q: 'LANDING' }).map(l => Number(l.id))).toEqual([2])
    expect(filterListings(data, { ...DEFAULT_FILTER, status: 'all', q: '#4' }).map(l => Number(l.id))).toEqual([4])
    expect(filterListings(data, { ...DEFAULT_FILTER, status: 'all', sort: 'budget' }).map(l => Number(l.id))).toEqual([2, 3, 1, 4])
  })
})
