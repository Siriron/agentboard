// Vercel Serverless Function — Circle Developer-Controlled Wallets
// Endpoints: POST /api/agent-wallet?action=create-wallet-set|create-wallet|execute
//            GET  /api/agent-wallet?action=balance|tx-status
//
// Uses Circle's official SDK so the entity secret is correctly RSA-encrypted
// into a fresh, one-time entitySecretCiphertext on every request. Circle's
// raw REST API requires that ciphertext to be generated per-call from your
// entity secret + Circle's current public key — sending the raw entity
// secret directly (as a previous version of this file did) is rejected by
// Circle with "API parameter invalid".

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
  res.setHeader('Access-Control-Allow-Origin', 'https://arc-agentboard.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action } = req.query

  if (!CIRCLE_ENABLED) {
    return res.status(503).json({
      error: 'Circle Dev-Controlled Wallets not configured',
      debug: {
        hasApiKey: !!process.env.CIRCLE_API_KEY,
        hasEntitySecret: !!process.env.CIRCLE_ENTITY_SECRET,
      },
      setup: 'Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to Vercel environment variables',
    })
  }

  try {
    const client = getCircleClient()

    // CREATE WALLET SET
    if (action === 'create-wallet-set' && req.method === 'POST') {
      const response = await client.createWalletSet({
        name: req.body?.name || 'AgentBoard Agents',
      })
      const walletSet = response.data?.walletSet
      if (!walletSet) throw new Error('Wallet set creation failed')
      return res.status(200).json({ walletSetId: walletSet.id })
    }

    // CREATE AGENT WALLET
    if (action === 'create-wallet' && req.method === 'POST') {
      const { walletSetId, agentName } = req.body || {}
      if (!walletSetId) return res.status(400).json({ error: 'walletSetId required' })
      const response = await client.createWallets({
        walletSetId,
        count: 1,
        blockchains: ['ARC-TESTNET'],
        accountType: "EOA", // Smart Contract Account — enables Gas Station
        metadata: [{ name: agentName || 'AgentBoard Agent', refId: `ab-${Date.now()}` }],
      })
      const wallet = response.data?.wallets?.[0]
      if (!wallet) throw new Error('Wallet creation failed')
      return res.status(200).json({
        walletId: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        accountType: wallet.accountType,
      })
    }

    // GET BALANCE
    if (action === 'balance' && req.method === 'GET') {
      const { walletId } = req.query
      if (!walletId) return res.status(400).json({ error: 'walletId required' })
      const response = await client.getWalletTokenBalance({ id: walletId })
      return res.status(200).json({ balances: response.data?.tokenBalances || [] })
    }

    // EXECUTE CONTRACT CALL
    if (action === 'execute' && req.method === 'POST') {
      const { walletId, contractAddress, calldata, memo } = req.body || {}
      if (!walletId || !contractAddress || !calldata)
        return res.status(400).json({ error: 'walletId, contractAddress, calldata required' })
      const response = await client.createContractExecutionTransaction({
        walletId,
        contractAddress,
        calldata,
        fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
        ...(memo ? { refId: memo } : {}),
      })
      const txId = response.data?.id
      if (!txId) throw new Error('Transaction submission failed')
      return res.status(200).json({ txId, status: 'PENDING' })
    }

    // POLL TX STATUS
    if (action === 'tx-status' && req.method === 'GET') {
      const { txId } = req.query
      if (!txId) return res.status(400).json({ error: 'txId required' })
      const response = await client.getTransaction({ id: txId })
      const tx = response.data?.transaction
      return res.status(200).json({
        state: tx?.state,
        txHash: tx?.txHash,
        errorReason: tx?.errorReason,
      })
    }

    return res.status(404).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[agent-wallet]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
