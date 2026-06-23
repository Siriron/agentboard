/**
 * AgentBoard — EIP-3009 Nanopayment Relay
 * POST /api/pay
 * 
 * Relays USDC transferWithAuthorization (EIP-3009) from an agent to a recipient.
 * Agent signs the authorization off-chain (no gas needed for signing).
 * This endpoint submits the signed authorization to Arc using Circle SDK.
 * 
 * This implements x402-style mid-job micropayments on Arc.
 * Circle Gateway's batched-x402 doesn't support Arc Testnet (Chain 5042002)
 * so we implement it natively using Arc USDC's EIP-3009 support.
 * 
 * Body:
 *   from        — agent wallet address
 *   to          — recipient address
 *   value       — USDC amount (display, e.g. 0.50)
 *   validAfter  — unix timestamp (0 for immediate)
 *   validBefore — unix timestamp (expiry)
 *   nonce       — bytes32 random nonce (hex)
 *   v, r, s     — EIP-712 signature components
 *   walletId    — Circle wallet ID that will relay (can be a server relay wallet)
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData } from 'viem'

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
const CIRCLE_ENABLED = !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET)

const USDC_ABI = [
  { name: 'transferWithAuthorization', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!CIRCLE_ENABLED) {
    return res.status(503).json({
      error: 'Circle credentials not configured',
      note: 'EIP-3009 relay requires CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in Vercel env vars',
    })
  }

  const { from, to, value, validAfter, validBefore, nonce, v, r, s, walletId } = req.body

  if (!from || !to || !value || !nonce || !v || !r || !s || !walletId) {
    return res.status(400).json({ error: 'Missing required EIP-3009 fields' })
  }

  // Validate amount
  const valueRaw = BigInt(Math.round(parseFloat(value) * 1e6))
  if (valueRaw <= 0n) return res.status(400).json({ error: 'Invalid value' })

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (validBefore && now > Number(validBefore)) {
    return res.status(400).json({ error: 'Authorization expired' })
  }

  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    })

    // Encode EIP-3009 transferWithAuthorization
    const calldata = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        to,
        valueRaw,
        BigInt(validAfter || 0),
        BigInt(validBefore || now + 3600),
        nonce,
        Number(v),
        r,
        s,
      ],
    })

    // Relay via Circle — uses relay wallet, not the sender's wallet
    const response = await client.createContractExecutionTransaction({
      walletId,
      contractAddress: USDC_ADDRESS,
      calldata,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    })

    const txId = response.data.id

    // Poll for confirmation
    let txHash = null
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const tx = await client.getTransaction({ id: txId })
      const state = tx.data.transaction.state
      if (state === 'CONFIRMED') { txHash = tx.data.transaction.txHash; break }
      if (['FAILED', 'DENIED'].includes(state)) throw new Error(`Payment ${state}`)
    }

    return res.status(200).json({
      status: 'payment_confirmed',
      from,
      to,
      value: parseFloat(value).toFixed(6),
      txHash,
      arcScan: `https://testnet.arcscan.app/tx/${txHash}`,
      type: 'eip3009_transfer_with_authorization',
    })
  } catch (e) {
    console.error('EIP-3009 relay error:', e)
    return res.status(500).json({ error: e.message || 'Payment relay failed' })
  }
}
