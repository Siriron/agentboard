// Vercel Serverless Function — Circle Developer-Controlled Wallets
// Endpoints: POST /api/agent-wallet?action=create-wallet-set|create-wallet|execute
//            GET  /api/agent-wallet?action=balance|tx-status

const CIRCLE_API = 'https://api.circle.com/v1/w3s'

async function circleRequest(path, method = 'GET', body = null) {
  if (!process.env.CIRCLE_API_KEY) throw new Error('CIRCLE_API_KEY not configured in Vercel environment variables')
  const res = await fetch(`${CIRCLE_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Circle API error ${res.status}`)
  return data
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://arc-agentboard.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action } = req.query

  try {
    // CREATE WALLET SET
    if (action === 'create-wallet-set' && req.method === 'POST') {
      const data = await circleRequest('/developer/walletSets', 'POST', {
        idempotencyKey: `ab-ws-${Date.now()}`,
        name: req.body?.name || 'AgentBoard Agents',
        entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
      })
      return res.status(200).json({ walletSetId: data.data?.walletSet?.id })
    }

    // CREATE AGENT WALLET
    if (action === 'create-wallet' && req.method === 'POST') {
      const { walletSetId, agentName } = req.body || {}
      if (!walletSetId) return res.status(400).json({ error: 'walletSetId required' })
      const data = await circleRequest('/developer/wallets', 'POST', {
        idempotencyKey: `ab-w-${Date.now()}`,
        accountType: 'SCA',
        blockchains: ['ARC-TESTNET'],
        count: 1,
        walletSetId,
        entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
        metadata: [{ name: agentName || 'AgentBoard Agent', refId: `ab-${Date.now()}` }],
      })
      const wallet = data.data?.wallets?.[0]
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
      const data = await circleRequest(`/wallets/${walletId}/balances`)
      return res.status(200).json({ balances: data.data?.tokenBalances || [] })
    }

    // EXECUTE CONTRACT CALL
    if (action === 'execute' && req.method === 'POST') {
      const { walletId, contractAddress, calldata, memo } = req.body || {}
      if (!walletId || !contractAddress || !calldata)
        return res.status(400).json({ error: 'walletId, contractAddress, calldata required' })
      const data = await circleRequest('/developer/transactions/contractExecution', 'POST', {
        idempotencyKey: `ab-tx-${Date.now()}`,
        walletId,
        contractAddress,
        calldata,
        fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
        entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
        ...(memo ? { note: memo } : {}),
      })
      const txId = data.data?.id
      if (!txId) throw new Error('Transaction submission failed')
      return res.status(200).json({ txId, status: 'PENDING' })
    }

    // POLL TX STATUS
    if (action === 'tx-status' && req.method === 'GET') {
      const { txId } = req.query
      if (!txId) return res.status(400).json({ error: 'txId required' })
      const data = await circleRequest(`/transactions/${txId}`)
      const tx = data.data?.transaction
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
