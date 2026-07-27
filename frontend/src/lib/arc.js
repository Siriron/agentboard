import { createPublicClient, createWalletClient, custom, http, encodeFunctionData, decodeEventLog } from 'viem'
import { ensureArcChain } from '../hooks/useWallet'
import { getActiveProvider } from './providerRegistry'

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
}

export const CONTRACT_ADDRESS = '0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4'
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
export const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const USDC_DECIMALS = 6

export const CONTRACT_ABI = [
  { name: 'registerAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [] },
  { name: 'postJob', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'title', type: 'string' }, { name: 'description', type: 'string' }, { name: 'category', type: 'string' }, { name: 'budget', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'submitBid', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'agentId', type: 'uint256' }, { name: 'proposedAmount', type: 'uint256' }, { name: 'proposal', type: 'string' }, { name: 'deliveryDays', type: 'uint256' }], outputs: [] },
  { name: 'withdrawBid', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { name: 'hireAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'bidIndex', type: 'uint256' }, { name: 'validator', type: 'address' }], outputs: [] },
  { name: 'submitWork', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'uri', type: 'string' }], outputs: [] },
  { name: 'validateAndRelease', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'notes', type: 'string' }], outputs: [] },
  { name: 'raiseDispute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'reason', type: 'string' }], outputs: [] },
  { name: 'resolveDispute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'toAgent', type: 'bool' }, { name: 'notes', type: 'string' }], outputs: [] },
  { name: 'cancelJob', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { name: 'expireJob', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [] },
  { name: 'getJobCore', type: 'function', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'client', type: 'address' }, { name: 'hiredAgent', type: 'address' }, { name: 'validator', type: 'address' }, { name: 'budget', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'postedAt', type: 'uint256' }, { name: 'expiresAt', type: 'uint256' }, { name: 'hiredAgentId', type: 'uint256' }, { name: 'bidCount', type: 'uint256' }, { name: 'status', type: 'uint8' }] }] },
  { name: 'getJobMeta', type: 'function', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [{ name: 'title', type: 'string' }, { name: 'description', type: 'string' }, { name: 'category', type: 'string' }, { name: 'deliverableURI', type: 'string' }, { name: 'resultNotes', type: 'string' }] }] },
  { name: 'getJobBids', type: 'function', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple[]', components: [{ name: 'agent', type: 'address' }, { name: 'agentId', type: 'uint256' }, { name: 'proposedAmount', type: 'uint256' }, { name: 'deliveryDays', type: 'uint256' }, { name: 'submittedAt', type: 'uint256' }, { name: 'proposal', type: 'string' }, { name: 'withdrawn', type: 'bool' }] }] },
  { name: 'getClientJobs', type: 'function', stateMutability: 'view', inputs: [{ name: 'client', type: 'address' }], outputs: [{ name: '', type: 'uint256[]' }] },
  { name: 'getAgentJobs', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256[]' }] },
  { name: 'isValidator', type: 'function', stateMutability: 'view', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'jobCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'agentIdRegistered', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'agentIdByAddress', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'JobPosted', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'client', type: 'address', indexed: true }, { name: 'title', type: 'string' }, { name: 'budget', type: 'uint256' }] },
  { name: 'AgentHired', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'agent', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }] },
  { name: 'JobValidated', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'agent', type: 'address', indexed: true }, { name: 'payout', type: 'uint256' }] },
  { name: 'BidSubmitted', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'agent', type: 'address', indexed: true }, { name: 'agentId', type: 'uint256' }, { name: 'proposedAmount', type: 'uint256' }] },
]

// Arc's official ERC-8004 IdentityRegistry (per docs.arc.network/arc/tutorials/register-your-first-ai-agent).
// register(string) mints a new identity NFT and returns no direct value to the
// caller (it's a state-changing tx) — the minted tokenId is read back from the
// Transfer event in the receipt, same pattern Arc's own quickstart uses.
export const IDENTITY_REGISTRY_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'metadataURI', type: 'string' }], outputs: [] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { name: 'Transfer', type: 'event', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }] },
]

export const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  // EIP-3009 transferWithAuthorization
  { name: 'transferWithAuthorization', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
  { name: 'nonces', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'DOMAIN_SEPARATOR', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
]

// One-click ERC-8004 identity mint. Calls register() on Arc's Identity
// Registry with a fully on-chain base64 metadata URI (no IPFS pinning
// needed), then reads the minted tokenId back from the Transfer event in
// the transaction receipt — exactly how Arc's own quickstart retrieves it,
// since a state-changing tx doesn't return values directly to the caller.
export async function mintAgentIdentity({ name, description }) {
  const wc = await getWalletClient()
  const [addr] = await wc.getAddresses()
  const pc = getPublicClient()

  const metadata = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: name || `AgentBoard Agent ${addr.slice(0, 6)}`,
    description: description || 'Registered via AgentBoard on Arc Testnet.',
    active: true,
  }
  const agentURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata))

  const tx = await wc.writeContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
    account: addr,
  })

  const receipt = await pc.waitForTransactionReceipt({ hash: tx })

  // The mint emits ERC-721 Transfer(0x0 -> owner, tokenId); decode it from
  // the receipt's logs rather than a second getLogs round-trip.
  let agentId = null
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== IDENTITY_REGISTRY.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({ abi: IDENTITY_REGISTRY_ABI, data: log.data, topics: log.topics })
      if (decoded.eventName === 'Transfer' && decoded.args.to.toLowerCase() === addr.toLowerCase()) {
        agentId = decoded.args.tokenId
      }
    } catch { /* not a Transfer log from this contract's ABI shape — skip */ }
  }

  if (agentId === null) {
    throw new Error('Mint transaction confirmed but no Transfer event was found — check the transaction on ArcScan.')
  }

  return { agentId: agentId.toString(), txHash: tx }
}

let _publicClient = null
export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: arcTestnet,
      // Board.jsx alone fires up to 2 calls per job (getJobCore +
      // getJobMeta) — 14 jobs is already 28 separate eth_call requests
      // on every page load, on top of Layout.jsx's own jobCount poll
      // every 30s. Arc's public testnet RPC rate-limits per-IP, and at
      // that volume it was throttling nearly every call ("request limit
      // reached" on all 14 job reads, confirmed via browser console).
      // batch: true merges same-tick JSON-RPC calls into a single HTTP
      // request — turns those 28 requests into as few as 1-3, which
      // directly reduces the odds of hitting the limit rather than just
      // handling the failure better after the fact.
      transport: http('https://rpc.testnet.arc.network', {
        batch: { batchSize: 40, wait: 50 },
        retryCount: 4,
        retryDelay: 800,
      }),
    })
  }
  return _publicClient
}

export async function getWalletClient() {
  const provider = getActiveProvider()
  if (!provider) throw new Error('No wallet detected. Please install MetaMask.')
  // Re-assert Arc Testnet right before signing — not just at initial
  // connect. If the wallet was switched to another chain in the meantime
  // (another dapp, the wallet's own UI), this catches it here instead of
  // silently sending the transaction to the wrong network.
  const result = await ensureArcChain()
  if (!result.ok) {
    throw new Error('Please switch your wallet to Arc Testnet to continue.')
  }
  return createWalletClient({ chain: arcTestnet, transport: custom(provider) })
}

// Arc Batch Transaction helper - combines multiple calls into one TX using Arc v0.7.2 batch support
export async function sendBatchTransaction(calls) {
  const wc = await getWalletClient()
  const [addr] = await wc.getAddresses()
  const pc = getPublicClient()
  const provider = getActiveProvider()
  // Arc supports EIP-5792 wallet_sendCalls for batching
  try {
    const batchResult = await provider.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '1.0',
        chainId: '0x4cef52', // 5042002 — corrected from '0x4CE352' (wrong chain)
        from: addr,
        calls: calls.map(c => ({
          to: c.to,
          data: encodeFunctionData({ abi: c.abi, functionName: c.functionName, args: c.args }),
          value: '0x0',
        }))
      }]
    })
    // wallet_sendCalls returns a batch ID; poll for completion
    let receipts = null
    while (!receipts) {
      await new Promise(r => setTimeout(r, 1200))
      try {
        const status = await provider.request({
          method: 'wallet_getCallsStatus',
          params: [batchResult]
        })
        if (status?.status === 'CONFIRMED' || status?.receipts?.length > 0) {
          receipts = status.receipts || []
        }
      } catch {}
    }
    return receipts[receipts.length - 1]?.transactionHash || batchResult
  } catch (e) {
    // Fallback: wallet doesn't support batching — execute sequentially
    let lastHash = null
    for (const c of calls) {
      const hash = await wc.writeContract({
        address: c.to,
        abi: c.abi,
        functionName: c.functionName,
        args: c.args,
        account: addr,
      })
      await pc.waitForTransactionReceipt({ hash })
      lastHash = hash
    }
    return lastHash
  }
}

// Transaction memo helper — Arc v0.7.2 supports arbitrary data field as memo
export function buildMemo(type, jobId, extra = '') {
  return `agentboard:${type}:${jobId}${extra ? ':' + extra : ''}`
}

// Sign and submit a contract call through a Circle-managed Agent Wallet
// instead of a browser extension — used when the user has picked "Agent
// Wallet" as their active signer. Encodes calldata client-side, submits it
// via the serverless /api/agent-wallet execute action, then polls
// tx-status until Circle reports a final state.
export async function executeViaAgentWallet({ walletId, contractAddress, abi, functionName, args, memo }) {
  const calldata = encodeFunctionData({ abi, functionName, args })

  const submitRes = await fetch('/api/agent-wallet?action=execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletId, contractAddress, calldata, memo }),
  })
  const submitData = await submitRes.json()
  if (!submitRes.ok) {
    throw new Error(submitData.error || submitData.likelyCause || 'Agent wallet transaction failed to submit')
  }
  const { txId } = submitData

  // Poll until Circle reports the transaction as complete or failed.
  const TERMINAL_STATES = ['COMPLETE', 'CONFIRMED', 'FAILED', 'CANCELLED']
  let state = 'PENDING'
  let txHash = null
  let errorReason = null
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const statusRes = await fetch(`/api/agent-wallet?action=tx-status&txId=${encodeURIComponent(txId)}`)
    const statusData = await statusRes.json()
    state = statusData.state || state
    txHash = statusData.txHash || txHash
    errorReason = statusData.errorReason || errorReason
    if (TERMINAL_STATES.includes(state)) break
  }

  if (state === 'FAILED' || state === 'CANCELLED') {
    throw new Error(errorReason || `Agent wallet transaction ${state.toLowerCase()}`)
  }
  if (!TERMINAL_STATES.includes(state)) {
    throw new Error('Agent wallet transaction is taking longer than expected — check its status from the Agent Wallet page.')
  }
  return { txId, txHash }
}

// Aggregate protocol stats computed from real job data — used on the
// landing page instead of hardcoded placeholder numbers. Caps how many
// Shared scan of recent jobs — used by both getProtocolStats and
// getOnchainLeaderboard so they read the same underlying data once each,
// rather than each page defining its own ad-hoc fetch.
async function scanRecentJobs(maxJobs = 60) {
  const pc = getPublicClient()
  const total = await pc.readContract({
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount',
  })
  const totalJobs = Number(total)
  const scanCount = Math.min(totalJobs, maxJobs)
  if (scanCount === 0) return { totalJobs, scanCount, cores: [] }

  const ids = Array.from({ length: scanCount }, (_, i) => BigInt(totalJobs - scanCount + i + 1))
  const cores = await Promise.all(
    ids.map(id => pc.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }).catch(() => null))
  )
  return { totalJobs, scanCount, cores: cores.filter(Boolean) }
}

// jobs it reads to stay cheap on a testnet with a small job count; if
// that cap is ever hit the number is presented as a floor ("50+") rather
// than a false total.
export async function getProtocolStats() {
  const { totalJobs, scanCount, cores } = await scanRecentJobs(60)

  if (scanCount === 0) {
    return { totalJobs: 0, escrowedUSDC: 0, totalBids: 0, scanned: 0, isPartial: false }
  }

  let escrowedRaw = 0n
  let totalBids = 0
  for (const core of cores) {
    // OPEN (0) or HIRED (1) — budget is still locked in the contract
    if (Number(core.status) === 0 || Number(core.status) === 1) {
      escrowedRaw += core.budget
    }
    totalBids += Number(core.bidCount)
  }

  return {
    totalJobs,
    escrowedUSDC: Number(escrowedRaw) / 1e6,
    totalBids,
    scanned: scanCount,
    isPartial: scanCount < totalJobs,
  }
}

// Real onchain leaderboard — ranks agents by jobs actually completed and
// paid out (status VALIDATED), aggregated directly from job data. No
// fabricated rows: an agent only appears here if they were genuinely
// hired and their work was genuinely validated onchain. Used as the
// leaderboard source until a Goldsky subgraph is deployed, at which
// point that becomes the faster source for a larger job history — this
// stays correct either way since it reads the same underlying facts.
export async function getOnchainLeaderboard(maxJobs = 60) {
  const { totalJobs, scanCount, cores } = await scanRecentJobs(maxJobs)
  if (scanCount === 0) return { agents: [], scanned: 0, isPartial: false }

  const byAgent = new Map()
  for (const core of cores) {
    if (Number(core.status) !== 3) continue // VALIDATED only — real, paid completions
    if (isZeroAddress(core.hiredAgent)) continue
    const key = core.hiredAgent.toLowerCase()
    const fee = (core.budget * 100n) / 10000n // matches PLATFORM_FEE_BPS
    const earned = core.budget - fee
    const prev = byAgent.get(key) || { address: core.hiredAgent, agentId: Number(core.hiredAgentId), jobsCompleted: 0, totalEarnedRaw: 0n }
    prev.jobsCompleted += 1
    prev.totalEarnedRaw += earned
    byAgent.set(key, prev)
  }

  const agents = Array.from(byAgent.values())
    .map(a => ({ ...a, totalEarned: Number(a.totalEarnedRaw) }))
    .sort((a, b) => b.totalEarnedRaw > a.totalEarnedRaw ? 1 : -1)

  return { agents, scanned: scanCount, isPartial: scanCount < totalJobs }
}

export const STATUS_LABEL = ['OPEN', 'HIRED', 'SUBMITTED', 'VALIDATED', 'DISPUTED', 'CANCELLED', 'EXPIRED']
export const STATUS_COLOR = ['#19fb9b', '#fbbf24', '#60a5fa', '#19fb9b', '#f87171', '#6b7280', '#6b7280']

export function formatUSDC(raw) {
  if (raw === undefined || raw === null) return '0.00'
  return (Number(raw) / 1e6).toFixed(2)
}
export function formatAddress(addr) {
  if (!addr || addr.length < 10) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
export function formatDate(ts) {
  const n = Number(ts)
  if (!n || n === 0) return '—'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function isZeroAddress(addr) {
  return !addr || addr === ZERO_ADDRESS || addr === '0x'
}
