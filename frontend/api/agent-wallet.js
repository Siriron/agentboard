// Vercel Serverless Function — Circle Developer-Controlled Wallets
// Endpoints: POST /api/agent-wallet?action=create-wallet-set|create-wallet|execute
//            GET  /api/agent-wallet?action=balance|tx-status|diagnose
//
// Uses Circle's official SDK so the entity secret is correctly RSA-encrypted
// into a fresh, one-time entitySecretCiphertext on every request.
//
// IMPORTANT — one-time setup required before any of this works:
// A Circle entity secret must be REGISTERED with Circle (producing a
// recovery file) before it can sign any wallet API call. Until that
// one-time registration is done, every call below — including
// create-wallet-set — fails with a plain 403 Forbidden from Circle's API.
// Run `npm run setup:circle` locally ONCE to do this. See
// /scripts/register-entity-secret.mjs and docs/circle-integration.md.

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const CIRCLE_ENABLED = !!(
  process.env.CIRCLE_API_KEY &&
  process.env.CIRCLE_ENTITY_SECRET
)

// A registered entity secret is always a 64-char hex string (32 bytes).
// The single most common deploy bug is a stray newline/space pasted into
// the Vercel env var box, or copying the wrong value — catch that here
// with a clear message instead of a mystery 403 three calls later.
function validateEntitySecretFormat(secret) {
  const trimmed = (secret || '').trim()
  if (trimmed !== secret) {
    return 'CIRCLE_ENTITY_SECRET has leading/trailing whitespace or a newline — re-paste it in Vercel env vars with no extra characters.'
  }
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return `CIRCLE_ENTITY_SECRET must be exactly 64 hex characters (32 bytes). Current value is ${trimmed.length} characters${/^[0-9a-fA-F]*$/.test(trimmed) ? '' : ' and contains non-hex characters'}. Generate a fresh one with the setup script.`
  }
  return null
}

function getCircleClient() {
  if (!CIRCLE_ENABLED) {
    throw new Error('Circle API credentials not configured')
  }
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  })
}

// Circle's SDK throws axios errors whose `.message` is just
// "Request failed with status code 403" — the actual reason lives in
// err.response.data. This pulls out the real reason and classifies the
// most common root causes so the frontend can show something actionable
// instead of a dead-end generic message.
function describeCircleError(err) {
  const status = err?.response?.status ?? err?.status ?? null
  const body = err?.response?.data ?? null
  const circleCode = body?.code ?? null
  const circleMessage = body?.message ?? null

  let likelyCause = null
  let fix = null

  if (status === 403) {
    likelyCause =
      'Your entity secret has not been registered with Circle yet. Circle rejects every wallet API call with a bare 403 until the one-time registration step is completed (this is unrelated to your API key being correct).'
    fix =
      'Run the one-time setup script locally: `npm run setup:circle` inside /frontend. It registers your entity secret with Circle and saves a recovery file. After that, every existing call here will start working with no other code changes.'
  } else if (status === 401) {
    likelyCause =
      'Circle rejected the API key itself — it is missing, revoked, or copied from the wrong environment (Mainnet vs Testnet key on the wrong environment, or used a Sandbox key on the production API).'
    fix =
      'Open console.circle.com → your Testnet entity → API Keys, generate or copy a key that starts with TEST_API_KEY:, and set it as CIRCLE_API_KEY in Vercel. Redeploy after changing env vars.'
  } else if (status === 400 && /entitySecretCiphertext|entity secret/i.test(circleMessage || '')) {
    likelyCause =
      'CIRCLE_ENTITY_SECRET is not a valid 64-character hex string, so the SDK could not encrypt a usable ciphertext for Circle.'
    fix = 'Regenerate it with `npm run setup:circle` and update the Vercel env var with the exact value it prints.'
  } else if (status === 429) {
    likelyCause = 'Circle is rate-limiting this API key (testnet has a request cap).'
    fix = 'Wait a minute and retry, or check your usage in the Circle Console.'
  }

  return { status, circleCode, circleMessage, likelyCause, fix }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://arc-agentboard.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.query

  if (!CIRCLE_ENABLED) {
    return res.status(503).json({
      error: 'Circle Dev-Controlled Wallets not configured',
      debug: {
        hasApiKey: !!process.env.CIRCLE_API_KEY,
        hasEntitySecret: !!process.env.CIRCLE_ENTITY_SECRET,
      },
      setup: 'Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to Vercel environment variables, then redeploy.',
    })
  }

  // ── DIAGNOSE — safe, read-only, never creates anything.
  // Validates env var format locally, then makes one lightweight read
  // call to Circle to confirm the entity secret is actually registered
  // and the API key is valid. Returns a plain-English diagnosis.
  if (action === 'diagnose' && req.method === 'GET') {
    const formatError = validateEntitySecretFormat(process.env.CIRCLE_ENTITY_SECRET)
    if (formatError) {
      return res.status(200).json({
        ok: false,
        stage: 'env-format',
        message: formatError,
      })
    }
    try {
      const client = getCircleClient()
      await client.listWalletSets({ pageSize: 1 }) // cheap read, no side effects
      return res.status(200).json({
        ok: true,
        stage: 'circle-api',
        message: 'Circle credentials are valid and the entity secret is registered. Wallet creation should work.',
      })
    } catch (err) {
      const info = describeCircleError(err)
      return res.status(200).json({
        ok: false,
        stage: 'circle-api',
        ...info,
        message: info.likelyCause || 'Circle rejected the request for an unknown reason — see circleMessage.',
      })
    }
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

    // CREATE AGENT WALLET (SCA)
    if (action === 'create-wallet' && req.method === 'POST') {
      const { walletSetId, agentName } = req.body || {}
      if (!walletSetId) return res.status(400).json({ error: 'walletSetId required' })

      const response = await client.createWallets({
        walletSetId,
        count: 1,
        blockchains: ['ARC-TESTNET'],
        accountType: 'SCA', // Smart Contract Account — required for Gas Station sponsorship
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
      if (!walletId || !contractAddress || !calldata) {
        return res.status(400).json({ error: 'walletId, contractAddress, calldata required' })
      }
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
      return res.status(200).json({ state: tx?.state, txHash: tx?.txHash, errorReason: tx?.errorReason })
    }

    return res.status(404).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[agent-wallet]', err?.response?.data || err)
    const info = describeCircleError(err)
    return res.status(info.status || 500).json({
      error: info.circleMessage || err.message || 'Internal server error',
      circleStatus: info.status,
      circleCode: info.circleCode,
      likelyCause: info.likelyCause,
      fix: info.fix,
    })
  }
}
