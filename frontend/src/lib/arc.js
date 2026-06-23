import { createPublicClient, createWalletClient, custom, http, encodeFunctionData } from 'viem'

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

export const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  // EIP-3009 transferWithAuthorization
  { name: 'transferWithAuthorization', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
  { name: 'nonces', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'DOMAIN_SEPARATOR', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
]

let _publicClient = null
export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: arcTestnet, transport: http('https://rpc.testnet.arc.network') })
  }
  return _publicClient
}

export async function getWalletClient() {
  if (!window.ethereum) throw new Error('No wallet detected. Please install MetaMask.')
  return createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) })
}

// Arc Batch Transaction helper - combines multiple calls into one TX using Arc v0.7.2 batch support
export async function sendBatchTransaction(calls) {
  const wc = await getWalletClient()
  const [addr] = await wc.getAddresses()
  const pc = getPublicClient()
  // Arc supports EIP-5792 wallet_sendCalls for batching
  try {
    const batchResult = await window.ethereum.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '1.0',
        chainId: '0x4CE352',
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
        const status = await window.ethereum.request({
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

export async function switchToArc() {
  if (!window.ethereum) throw new Error('No wallet detected')
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x4CE352' }] })
  } catch (e) {
    if (e.code === 4902 || e.code === -32603) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: '0x4CE352', chainName: 'Arc Testnet', nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 }, rpcUrls: ['https://rpc.testnet.arc.network'], blockExplorerUrls: ['https://testnet.arcscan.app'] }],
      })
    } else throw e
  }
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
