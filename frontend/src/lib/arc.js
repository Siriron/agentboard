import { createPublicClient, createWalletClient, custom, http } from 'viem'

// BUG FIX 1: chainId hex 0x4CE352 = 5042002 ✓ confirmed correct
export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['http://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'http://testnet.arcscan.app' } },
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
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'JobPosted', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'client', type: 'address', indexed: true }, { name: 'title', type: 'string' }, { name: 'budget', type: 'uint256' }] },
  { name: 'AgentHired', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'agent', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }] },
  { name: 'JobValidated', type: 'event', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'agent', type: 'address', indexed: true }, { name: 'payout', type: 'uint256' }] },
]

export const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
]

// BUG FIX 2: publicClient was being recreated on every call causing memory leaks
// Cache the public client as a singleton
let _publicClient = null
export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: arcTestnet, transport: http('http://rpc.testnet.arc.network') })
  }
  return _publicClient
}

export async function getWalletClient() {
  if (!window.ethereum) throw new Error('No wallet detected. Please install MetaMask.')
  return createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) })
}

export async function switchToArc() {
  if (!window.ethereum) throw new Error('No wallet detected')
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x4CE352' }],
    })
  } catch (e) {
    // BUG FIX 3: some wallets use code 4902, others use -32603 for unrecognized chain
    if (e.code === 4902 || e.code === -32603) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x4CE352',
          chainName: 'Arc Testnet',
          nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          rpcUrls: ['http://rpc.testnet.arc.network'],
          blockExplorerUrls: ['http://testnet.arcscan.app'],
        }],
      })
    } else {
      throw e
    }
  }
}

export const STATUS_LABEL = ['OPEN', 'HIRED', 'SUBMITTED', 'VALIDATED', 'DISPUTED', 'CANCELLED', 'EXPIRED']
export const STATUS_COLOR = ['#00ff88', '#f59e0b', '#60a5fa', '#00ff88', '#ef4444', '#6b7280', '#6b7280']

// BUG FIX 4: formatUSDC crashed on undefined/null — add guard
export function formatUSDC(raw) {
  if (raw === undefined || raw === null) return '0.00'
  return (Number(raw) / 1e6).toFixed(2)
}

// BUG FIX 5: formatAddress crashed when addr was undefined/null/short
export function formatAddress(addr) {
  if (!addr || addr.length < 10) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// BUG FIX 6: formatDate crashed on BigInt 0 (uninitialised timestamps)
export function formatDate(ts) {
  const n = Number(ts)
  if (!n || n === 0) return '—'
  return new Date(n * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// BUG FIX 7: isZeroAddress helper — used in JobDetail to check hiredAgent
export function isZeroAddress(addr) {
  return !addr || addr === ZERO_ADDRESS || addr === '0x'
}
