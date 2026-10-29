import { describe, expect, it } from 'vitest'
import { keccak256, toHex, zeroAddress, pad } from 'viem'
import { IDENTITY_REGISTRY, agentIdFromLogs, agentIdsFromExplorer, parseExplorerNfts } from './agents'

const ME = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const TRANSFER = keccak256(toHex('Transfer(address,address,uint256)'))
const log = (address: string, from: string, to: string, id: bigint) => ({
  address, data: '0x' as const,
  topics: [TRANSFER, pad(from as `0x${string}`), pad(to as `0x${string}`), pad(toHex(id))] as `0x${string}`[],
})

describe('agentIdFromLogs', () => {
  it('reads the minted id for the owner', () => {
    expect(agentIdFromLogs([log(IDENTITY_REGISTRY, zeroAddress, ME, 42n)], ME)).toBe(42n)
  })
  it('ignores other registries, other owners and non-mint transfers', () => {
    expect(agentIdFromLogs([log(OTHER, zeroAddress, ME, 1n), log(IDENTITY_REGISTRY, zeroAddress, OTHER, 2n), log(IDENTITY_REGISTRY, OTHER, ME, 3n)], ME)).toBeNull()
  })
  it('does not throw on junk logs', () => {
    expect(agentIdFromLogs([{ address: IDENTITY_REGISTRY, data: '0x', topics: ['0x1234' as `0x${string}`] }], ME)).toBeNull()
  })
})

describe('parseExplorerNfts', () => {
  const item = (id: unknown, addr: unknown) => ({ id, token: { address_hash: addr } })
  it('keeps only registry tokens with numeric ids and returns the next page', () => {
    const r = parseExplorerNfts({ items: [item('7', IDENTITY_REGISTRY.toLowerCase()), item('8', OTHER), item('x9', IDENTITY_REGISTRY), item(5, IDENTITY_REGISTRY)], next_page_params: { token_id: '7', token_contract_address_hash: 'abc', skip: null } })
    expect(r.ids).toEqual(['7'])
    expect(r.next).toEqual({ token_id: '7', token_contract_address_hash: 'abc' })
  })
  it('tolerates garbage', () => {
    expect(parseExplorerNfts(null)).toEqual({ ids: [], next: null })
    expect(parseExplorerNfts({ items: 'no' })).toEqual({ ids: [], next: null })
  })
})

describe('agentIdsFromExplorer', () => {
  it('returns null when the explorer fails so callers can fall back', async () => {
    expect(await agentIdsFromExplorer(ME, (async () => { throw new Error('down') }) as unknown as typeof fetch)).toBeNull()
    expect(await agentIdsFromExplorer(ME, (async () => ({ ok: false })) as unknown as typeof fetch)).toBeNull()
  })
  it('follows pagination', async () => {
    let n = 0
    const f = (async () => ({ ok: true, json: async () => (n++ === 0 ? { items: [{ id: '1', token: { address_hash: IDENTITY_REGISTRY } }], next_page_params: { a: '1' } } : { items: [{ id: '2', token: { address_hash: IDENTITY_REGISTRY } }], next_page_params: null }) })) as unknown as typeof fetch
    expect(await agentIdsFromExplorer(ME, f)).toEqual(['1', '2'])
  })
})
