// Circle Dev-Controlled Wallets — frontend client
// All sensitive operations go through /api/agent-wallet (serverless)
// This file handles the frontend-facing calls and EIP-3009 signing

import { getPublicClient, USDC_ADDRESS } from './arc'
import { encodeFunctionData } from 'viem'

const API_BASE = '/api/agent-wallet'

async function apiCall(action, method = 'GET', body = null) {
  const url = `${API_BASE}?action=${action}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

// ── WALLET MANAGEMENT ──

export async function createWalletSet(name = 'AgentBoard Agents') {
  return apiCall('create-wallet-set', 'POST', { name })
}

export async function createAgentWallet(walletSetId, agentName) {
  return apiCall('create-wallet', 'POST', { walletSetId, agentName })
}

export async function getWalletBalance(walletId) {
  const url = `${API_BASE}?action=balance&walletId=${encodeURIComponent(walletId)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

// ── CONTRACT EXECUTION ──

export async function executeContractCall({ walletId, contractAddress, abi, functionName, args, memo }) {
  const calldata = encodeFunctionData({ abi, functionName, args })
  const result = await apiCall('execute', 'POST', { walletId, contractAddress, calldata, memo })
  return result.txId
}

export async function pollTransaction(txId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const url = `${API_BASE}?action=tx-status&txId=${encodeURIComponent(txId)}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
    const status = data
    if (status.state === 'COMPLETE' || status.state === 'CONFIRMED') return status
    if (['FAILED', 'DENIED', 'CANCELLED'].includes(status.state)) {
      throw new Error(`Transaction ${status.state}: ${status.errorReason || 'unknown error'}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error('Transaction timeout')
}

// ── EIP-3009 NANOPAYMENT SIGNING ──
// Agent signs a USDC transferWithAuthorization off-chain
// Server relays it on-chain — agent never pays gas

const TRANSFER_WITH_AUTHORIZATION_TYPE = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
]

export async function signNanopayment({ from, to, amount, validDurationSeconds = 300 }) {
  if (!window.ethereum) throw new Error('No wallet detected')

  const pc = getPublicClient()
  const now = Math.floor(Date.now() / 1000)
  const validAfter = 0
  const validBefore = now + validDurationSeconds
  const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`
  const value = BigInt(Math.round(amount * 1e6))

  // Get DOMAIN_SEPARATOR from USDC contract
  const domainSeparator = await pc.readContract({
    address: USDC_ADDRESS,
    abi: [{ name: 'DOMAIN_SEPARATOR', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }],
    functionName: 'DOMAIN_SEPARATOR',
  })

  // Sign EIP-712 typed data
  const signature = await window.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [from, JSON.stringify({
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION_TYPE,
      },
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 5042002,
        verifyingContract: USDC_ADDRESS,
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from,
        to,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    })],
  })

  // Split signature into v, r, s
  const sig = signature.slice(2)
  const r = `0x${sig.slice(0, 64)}`
  const s = `0x${sig.slice(64, 128)}`
  const v = parseInt(sig.slice(128, 130), 16)

  return { from, to, value: value.toString(), validAfter, validBefore, nonce, v, r, s }
}

export async function relayNanopayment(signedAuth, memo) {
  const res = await fetch('/api/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...signedAuth, memo }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Payment relay failed')
  return data
}
