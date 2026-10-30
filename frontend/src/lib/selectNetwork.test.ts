import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
;(globalThis as any).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }

describe('selectNetwork', () => {
  beforeEach(() => store.clear())
  it('switches to testnet without any confirmation', async () => {
    const { selectNetwork } = await import('./selectNetwork')
    const set = vi.fn(), confirm = vi.fn()
    expect(await selectNetwork('testnet', 'mainnet', set, confirm)).toBe(true)
    expect(set).toHaveBeenCalledWith('testnet'); expect(confirm).not.toHaveBeenCalled()
  })
  it('asks once for mainnet, then remembers for the session', async () => {
    const { selectNetwork } = await import('./selectNetwork')
    const set = vi.fn(), confirm = vi.fn().mockResolvedValue(true)
    await selectNetwork('mainnet', 'testnet', set, confirm); await selectNetwork('mainnet', 'testnet', set, confirm)
    expect(confirm).toHaveBeenCalledTimes(1); expect(set).toHaveBeenCalledTimes(2)
  })
  it('does not switch when mainnet is declined', async () => {
    const { selectNetwork } = await import('./selectNetwork')
    const set = vi.fn()
    expect(await selectNetwork('mainnet', 'testnet', set, async () => false)).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })
  it('does nothing when the network is already selected', async () => {
    const { selectNetwork } = await import('./selectNetwork')
    const set = vi.fn(), confirm = vi.fn()
    expect(await selectNetwork('mainnet', 'mainnet', set, confirm)).toBe(true)
    expect(set).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
  })
})
