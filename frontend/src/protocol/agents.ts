// ERC-8004 agent identity and reputation on Arc Mainnet (read + register).
// Signatures come from the Arc ERC-8004 quickstart (docs.arc.io) and the reference implementation
// (erc-8004/erc-8004-contracts). Registry addresses: docs.arc.io/arc/references/contract-addresses.

import { decodeEventLog, getAddress, isAddress, zeroAddress, type Address, type Hex } from 'viem'
import { AppError } from './errors'
import { decodeMeta, encodeMeta } from './hashing'
import { send, v2Client } from './v2core'

export const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address
export const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address

export const identityAbi = [
  { type: 'function', name: 'register', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] },
] as const

export const reputationAbi = [
  { type: 'function', name: 'getClients', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'address[]' }] },
  {
    type: 'function', name: 'getSummary', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'clientAddresses', type: 'address[]' }, { name: 'tag1', type: 'string' }, { name: 'tag2', type: 'string' }],
    outputs: [{ name: 'count', type: 'uint64' }, { name: 'summaryValue', type: 'int128' }, { name: 'summaryValueDecimals', type: 'uint8' }],
  },
] as const

export interface AgentMeta { name?: string; description?: string; capabilities?: string[]; endpoint?: string }
export interface Agent { id: bigint; owner: Address; uri: string; meta: AgentMeta | null }
export interface Reputation { clients: number; count: bigint; average: number | null }

/** The agent id minted by a register() receipt: the registry's Transfer(0x0 -> owner, id) log. Pure, so it is unit-tested. */
export function agentIdFromLogs(logs: readonly { address: string; data: Hex; topics: readonly Hex[] }[], owner: Address, registry: Address = IDENTITY_REGISTRY): bigint | null {
  for (const l of logs) {
    if (l.address.toLowerCase() !== registry.toLowerCase()) continue
    try {
      const d = decodeEventLog({ abi: identityAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
      if (d.eventName === 'Transfer' && d.args.from === zeroAddress && d.args.to.toLowerCase() === owner.toLowerCase()) return d.args.tokenId
    } catch { /* not a registry event */ }
  }
  return null
}

const idsKey = (a: string) => `agentboard.agents.${a.toLowerCase()}`
function rememberedIds(owner: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(idsKey(owner)) || '[]'); return Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string' && /^\d{1,30}$/.test(x)) : [] } catch { return [] }
}
function rememberId(owner: string, id: bigint) {
  try { localStorage.setItem(idsKey(owner), JSON.stringify([...new Set([id.toString(), ...rememberedIds(owner)])].slice(0, 50))) } catch { /* storage blocked: the explorer lookup still finds it */ }
}

export async function registerAgent(p: { name: string; description: string; capabilities: string; endpoint: string }): Promise<{ hash: Hex; agentId: bigint | null }> {
  const name = p.name.trim()
  if (!name) throw new AppError('Give the agent a name.')
  if (p.endpoint.trim() && !/^https:\/\//i.test(p.endpoint.trim())) throw new AppError('The endpoint must be an https link.')
  const caps = p.capabilities.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)
  const uri = encodeMeta({ type: 'agent', name, description: p.description.trim().slice(0, 1000), capabilities: caps, endpoint: p.endpoint.trim() || undefined })
  const { hash } = await send({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'register', args: [uri] })
  // The id comes from the receipt's mint log. If the read fails the registration still happened, so do not throw.
  let agentId: bigint | null = null
  try {
    const rc = await v2Client().getTransactionReceipt({ hash })
    agentId = agentIdFromLogs(rc.logs as never, rc.from)
    if (agentId !== null) rememberId(rc.from, agentId)
  } catch { /* the My agents list will find it through the explorer */ }
  return { hash, agentId }
}

export async function getAgent(id: bigint): Promise<Agent | null> {
  const pc = v2Client()
  try {
    const [owner, uri] = await Promise.all([
      pc.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'ownerOf', args: [id] }),
      pc.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'tokenURI', args: [id] }),
    ])
    return { id, owner, uri, meta: decodeMeta<AgentMeta>(uri) }
  } catch { return null } // nonexistent token reverts
}

/** Pure: pull agent ids for one registry out of a Blockscout `/addresses/{a}/nft` page. Everything is validated. */
export function parseExplorerNfts(json: unknown, registry: Address = IDENTITY_REGISTRY): { ids: string[]; next: Record<string, string> | null } {
  const o = (json && typeof json === 'object' ? json : {}) as { items?: unknown; next_page_params?: unknown }
  const ids: string[] = []
  for (const it of Array.isArray(o.items) ? o.items : []) {
    const item = it as { id?: unknown; token?: { address_hash?: unknown; address?: unknown } }
    const addr = item?.token?.address_hash ?? item?.token?.address
    if (typeof addr !== 'string' || addr.toLowerCase() !== registry.toLowerCase()) continue
    if (typeof item.id === 'string' && /^\d{1,30}$/.test(item.id)) ids.push(item.id)
  }
  const n = o.next_page_params
  let next: Record<string, string> | null = null
  if (n && typeof n === 'object') {
    next = {}
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) if (v !== null && v !== undefined && /^[\w.]+$/.test(k)) next[k] = String(v)
  }
  return { ids, next }
}

const EXPLORER_API = 'https://explorer.arc.io/api/v2'

/** Agent ids owned by `owner` according to the explorer. Returns null when the explorer cannot be reached. */
export async function agentIdsFromExplorer(owner: Address, fetchImpl: typeof fetch = fetch): Promise<string[] | null> {
  if (!isAddress(owner)) return null
  const ids: string[] = []
  let params: Record<string, string> | null = {}
  try {
    for (let page = 0; page < 5 && params; page++) {
      const qs = new URLSearchParams({ type: 'ERC-721', ...params })
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000)
      let res: Response
      try { res = await fetchImpl(`${EXPLORER_API}/addresses/${getAddress(owner)}/nft?${qs}`, { signal: ctrl.signal, headers: { accept: 'application/json' } }) } finally { clearTimeout(t) }
      if (!res.ok) return page === 0 ? null : ids
      const parsed = parseExplorerNfts(await res.json())
      ids.push(...parsed.ids)
      params = parsed.next
    }
    return ids
  } catch { return null }
}

/**
 * Agents owned by `me`. Never throws: the explorer is the primary source, ids remembered from registrations
 * on this device are the fallback, and every candidate is confirmed with ownerOf before it is shown.
 */
export async function getMyAgents(me: Address): Promise<Agent[]> {
  const fromExplorer = await agentIdsFromExplorer(me)
  const ids = new Set<string>([...(fromExplorer ?? []), ...rememberedIds(me)])
  const out: Agent[] = []
  await Promise.all([...ids].slice(0, 100).map(async s => { const a = await getAgent(BigInt(s)); if (a && a.owner.toLowerCase() === me.toLowerCase()) out.push(a) }))
  return out.sort((x, y) => (x.id < y.id ? 1 : -1))
}

export async function getReputation(id: bigint): Promise<Reputation> {
  const pc = v2Client()
  const clients = await pc.readContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, functionName: 'getClients', args: [id] })
  if (clients.length === 0) return { clients: 0, count: 0n, average: null }
  const [count, value, decimals] = await pc.readContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, functionName: 'getSummary', args: [id, [...clients], '', ''] })
  return { clients: clients.length, count, average: count === 0n ? null : Number(value) / 10 ** Number(decimals) }
}
