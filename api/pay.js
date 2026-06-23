// Vercel Serverless Function — EIP-3009 Nanopayment Relay
// POST /api/pay
// Relays a USDC transferWithAuthorization signed by an agent
// Agent signs off-chain, this endpoint verifies and submits on-chain
// No private key needed from the agent

import { createPublicClient, http, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
}

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
const USDC_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://arc-agentboard.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { from, to, value, validAfter, validBefore, nonce, v, r, s, memo } = req.body || {}

  // Validate all required fields
  const missing = ['from','to','value','validAfter','validBefore','nonce','v','r','s'].filter(k => !req.body?.[k])
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` })

  // Validate timing
  const now = Math.floor(Date.now() / 1000)
  if (now < Number(validAfter)) return res.status(400).json({ error: 'Authorization not yet valid' })
  if (now > Number(validBefore)) return res.status(400).json({ error: 'Authorization expired' })

  // Relay key — this is a funded relayer wallet, not the user's wallet
  // Set RELAYER_PRIVATE_KEY in Vercel env vars — a funded Arc testnet wallet for gas
  const relayerKey = process.env.RELAYER_PRIVATE_KEY
  if (!relayerKey) return res.status(500).json({ error: 'Relayer not configured' })

  try {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() })
    const account = privateKeyToAccount(relayerKey)
    const walletClient = createWalletClient({ chain: arcTestnet, transport: http(), account })

    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: [from, to, BigInt(value), BigInt(validAfter), BigInt(validBefore), nonce, v, r, s],
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    console.log(`[pay] ${from} → ${to} ${(Number(value)/1e6).toFixed(2)} USDC | memo: ${memo || 'none'} | tx: ${txHash}`)

    return res.status(200).json({
      txHash,
      from,
      to,
      amount: (Number(value) / 1e6).toFixed(6),
      memo: memo || null,
      arcScan: `https://testnet.arcscan.app/tx/${txHash}`,
    })
  } catch (err) {
    console.error('[pay]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
