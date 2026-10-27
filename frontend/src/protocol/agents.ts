// ERC-8004 agent identity and reputation on Arc Mainnet (read + register).
// Signatures come from the Arc ERC-8004 quickstart (docs.arc.io) and the reference implementation
// (erc-8004/erc-8004-contracts). Registry addresses: docs.arc.io/arc/references/contract-addresses.

import { decodeEventLog, type Address, type Hex } from 'viem'
import { AppError } from './errors'
import { decodeMeta, encodeMeta } from './hashing'
import { send, v2Client, getLogsFrom } from './v2core'

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

export function registerAgent(p: { name: string; description: string; capabilities: string; endpoint: string }) {
  const name = p.name.trim()
  if (!name) throw new AppError('Give the agent a name.')
  if (p.endpoint.trim() && !/^https:\/\//i.test(p.endpoint.trim())) throw new AppError('The endpoint must be an https link.')
  const caps = p.capabilities.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)
  const uri = encodeMeta({ type: 'agent', name, description: p.description.trim().slice(0, 1000), capabilities: caps, endpoint: p.endpoint.trim() || undefined })
  return send({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'register', args: [uri] })
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

export async function getMyAgents(me: Address): Promise<Agent[]> {
  const pc = v2Client()
  // The registry predates the app's default start block, so read from genesis. `to` is an indexed topic,
  // so providers that allow wide ranges answer in one call; otherwise coarse steps keep it bounded.
  const logs = await getLogsFrom({ address: IDENTITY_REGISTRY, event: identityAbi[4], args: { to: me } }, { from: 0n, steps: [0n, 5_000_000n, 1_000_000n] })
  const ids = new Set<string>()
  for (const l of logs) {
    const d = decodeEventLog({ abi: identityAbi, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
    if (d.eventName === 'Transfer') ids.add(String(d.args.tokenId))
  }
  const out: Agent[] = []
  await Promise.all([...ids].map(async s => { const a = await getAgent(BigInt(s)); if (a && a.owner.toLowerCase() === me.toLowerCase()) out.push(a) }))
  return out.sort((x, y) => (x.id < y.id ? 1 : -1))
}

export async function getReputation(id: bigint): Promise<Reputation> {
  const pc = v2Client()
  const clients = await pc.readContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, functionName: 'getClients', args: [id] })
  if (clients.length === 0) return { clients: 0, count: 0n, average: null }
  const [count, value, decimals] = await pc.readContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, functionName: 'getSummary', args: [id, [...clients], '', ''] })
  return { clients: clients.length, count, average: count === 0n ? null : Number(value) / 10 ** Number(decimals) }
}
