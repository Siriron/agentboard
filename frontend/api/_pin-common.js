import { createPublicClient, http } from 'viem'

// Defaults are the deployed Arc mainnet V2 contracts, so no env is needed. Env overrides for other deployments.
export const RPC = process.env.ARC_MAINNET_RPC || 'https://rpc.mainnet.arc.io'
export const KERNEL = process.env.V2_KERNEL || '0x7342462dF8373a84e7d8F0E5336E3730c6a0fCC5'
export const ROUTER = process.env.V2_ROUTER || '0x483EB91ad48387210B9DD92301Cc99B86e6d4815'
export const KINDS = ['deliverable', 'evidence', 'reason']
export const MAX_BYTES = 4 * 1024 * 1024 // Vercel functions cap request bodies at 4.5 MB
export const PREFIX = 'v2'

export const chain = { id: 5042, name: 'Arc', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }
export const client = () => createPublicClient({ chain, transport: http(RPC) })

/** The app calls these endpoints from its own origin, so only same-host requests are allowed. */
export function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try { return new URL(origin).host === req.headers.host } catch { return false }
}

export const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN
