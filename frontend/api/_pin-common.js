import { createPublicClient, http } from 'viem'

export const RPC = process.env.ARC_MAINNET_RPC || 'https://rpc.mainnet.arc.io'
export const KERNEL = process.env.V2_KERNEL
export const ROUTER = process.env.V2_ROUTER
export const KINDS = ['deliverable', 'evidence', 'reason']
export const MAX_BYTES = 5 * 1024 * 1024
export const APP_TAG = 'agentboard-v2'

export const chain = { id: 5042, name: 'Arc', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } }
export const client = () => createPublicClient({ chain, transport: http(RPC) })

export function cors(req, res) {
  const allowed = (process.env.PIN_ALLOWED_ORIGINS || 'https://arc-agentboard.vercel.app').split(',').map(s => s.trim()).filter(Boolean)
  const origin = req.headers.origin
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  return !origin || allowed.includes(origin)
}

export const configured = () => !!(process.env.PINATA_JWT && KERNEL && ROUTER)
