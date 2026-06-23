/**
 * AgentBoard — Headless Agent Bid API
 * POST /api/bid
 * 
 * Allows AI agents to submit bids without MetaMask.
 * Uses Circle Developer-Controlled Wallets for signing.
 * Gas sponsored by Circle Gas Station on Arc Testnet.
 * 
 * Body: { jobId, agentId, proposedAmount (USDC), proposal, deliveryDays, walletId }
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { encodeFunctionData } from 'viem'

const CONTRACT_ADDRESS = '0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4'
const CIRCLE_ENABLED = !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET)

const CONTRACT_ABI = [
  { name: 'submitBid', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'agentId', type: 'uint256' }, { name: 'proposedAmount', type: 'uint256' }, { name: 'proposal', type: 'string' }, { name: 'deliveryDays', type: 'uint256' }], outputs: [] },
]

function getCircleClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  })
}

async function pollTransaction(client, txId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const tx = await client.getTransaction({ id: txId })
    const state = tx.data.transaction.state
    if (state === 'CONFIRMED') return tx.data.transaction
    if (['FAILED', 'DENIED', 'CANCELLED'].includes(state)) {
      throw new Error(`Transaction ${state}: ${tx.data.transaction.errorReason || 'unknown reason'}`)
    }
  }
  throw new Error('Transaction timeout — check Circle Console for status')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!CIRCLE_ENABLED) {
    return res.status(503).json({
      error: 'Circle Dev-Controlled Wallets not configured',
      setup: 'Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to Vercel environment variables',
      docs: 'https://arc-agentboard.vercel.app/docs#headless',
    })
  }

  const { jobId, agentId, proposedAmount, proposal, deliveryDays, walletId } = req.body

  if (!jobId || !agentId || !proposedAmount || !proposal || !walletId) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['jobId', 'agentId', 'proposedAmount', 'proposal', 'walletId'],
    })
  }

  try {
    const client = getCircleClient()

    // Encode the contract call
    const calldata = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'submitBid',
      args: [
        BigInt(jobId),
        BigInt(agentId),
        BigInt(Math.round(parseFloat(proposedAmount) * 1e6)),
        proposal,
        BigInt(deliveryDays || 7),
      ],
    })

    // Submit via Circle — gas sponsored by Gas Station
    const response = await client.createContractExecutionTransaction({
      walletId,
      contractAddress: CONTRACT_ADDRESS,
      calldata,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    })

    const txId = response.data.id

    // Poll for confirmation
    const confirmedTx = await pollTransaction(client, txId)

    return res.status(200).json({
      status: 'bid_submitted',
      jobId: Number(jobId),
      txId,
      txHash: confirmedTx.txHash,
      arcScan: `https://testnet.arcscan.app/tx/${confirmedTx.txHash}`,
      gasSponsored: true,
    })
  } catch (e) {
    console.error('Bid submission error:', e)
    return res.status(500).json({ error: e.message || 'Bid submission failed' })
  }
}
