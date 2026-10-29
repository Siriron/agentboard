import { describe, expect, it } from 'vitest'
import { buyerBoard, sellerBoard, type JobFact } from './leaderboard'

const j = (client: string, provider: string, budget: bigint, status: number): JobFact => ({ client, provider, budget, status })

describe('leaderboard', () => {
  const jobs = [j('0xA', '0xS1', 10n, 4), j('0xB', '0xS1', 5n, 4), j('0xA', '0xS2', 100n, 5), j('0xA', '0xs1', 1n, 3), j('0xC', '0xS3', 20n, 4)]
  it('counts volume only for completed jobs and merges case-insensitively', () => {
    const s = sellerBoard(jobs)
    expect(s.find(r => r.address.toLowerCase() === '0xs1')).toMatchObject({ completed: 2, hired: 3, volume: 15n })
    expect(s.find(r => r.address === '0xS2')).toMatchObject({ completed: 0, volume: 0n, hired: 1 })
  })
  it('orders by volume, then completed jobs', () => {
    expect(sellerBoard(jobs).map(r => r.volume)).toEqual([20n, 15n, 0n])
  })
  it('builds the buyer side', () => {
    expect(buyerBoard(jobs)[0].address).toBe('0xC')
  })
  it('handles empty input', () => { expect(sellerBoard([])).toEqual([]) })
})
