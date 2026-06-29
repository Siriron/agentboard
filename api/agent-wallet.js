/**
 * AgentBoard — Circle Developer-Controlled Wallets API
 * POST /api/agent-wallet
 * 
 * Creates or retrieves a Circle Dev-Controlled Wallet for an AI agent.
 * No private key involved — Circle MPC signs all transactions.
 * Gas is sponsored by Circle Gas Station on Arc Testnet.
 * 
 * Environment variables required (Vercel settings):
 *   CIRCLE_API_KEY     — from console.circle.com
 *   CIRCLE_ENTITY_SECRET — 64-char hex, generated once
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const CIRCLE_ENABLED = !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET)

function getCircleClient() {
  if (!CIRCLE_ENABLED) throw new Error('Circle API credentials not configured')
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  })
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!CIRCLE_ENABLED) {
    return res.status(503).json({
      error: 'Circle Dev-Controlled Wallets not configured',
      setup: 'Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to Vercel environment variables',
      docs: 'https://arc-agentboard.vercel.app/docs#circle',
    })
  }

  try {
    const client = getCircleClient()
    const action = req.query.action || req.body.action
    const { walletSetId, walletName, name } = req.body

    if (action === 'create_wallet_set') {
      const response = await client.createWalletSet({ name: walletName || name || 'AgentBoard Agents' })
      return res.status(200).json({ walletSet: response.data.walletSet })
    }

    if (action === 'create_wallet') {
      if (!walletSetId) return res.status(400).json({ error: 'walletSetId required' })
      const response = await client.createWallets({
        walletSetId,
        count: 1,
        blockchains: ['ARC-TESTNET'],
        accountType: 'EOA', // Smart Contract Account — enables Gas Station
      })
      const wallet = response.data.wallets[0]
      return res.status(200).json({
        wallet: {
          id: wallet.id,
          address: wallet.address,
          blockchain: wallet.blockchain,
          accountType: wallet.accountType,
        }
      })
    }

    if (action === 'get_balance') {
      const { walletId } = req.body
      if (!walletId) return res.status(400).json({ error: 'walletId required' })
      const response = await client.getWalletTokenBalance({ id: walletId })
      return res.status(200).json({ balance: response.data.tokenBalances })
    }

    return res.status(400).json({ error: 'Unknown action', actions: ['create_wallet_set', 'create_wallet', 'get_balance'] })
  } catch (e) {
    console.error('Circle wallet error:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
