// Network registry — the single source of truth for per-network chain facts.
//
// TESTNET values are carried over verbatim from the original app so testnet
// behavior is unchanged (including its existing RPC host and wallet params).
// MAINNET values follow Arc's current docs: native USDC has 18 decimals, the
// ERC-20 view at USDC address has 6, and maxFeePerGas must be >= 20 Gwei.
//
// Re-check every mainnet address against docs.arc.io/arc/references/contract-addresses
// (and `cast code <addr> --rpc-url https://rpc.mainnet.arc.io`) before enabling it.

export const NETWORK_KEYS = ['testnet', 'mainnet']

export const NETWORKS = {
  testnet: {
    key: 'testnet',
    label: 'Arc Testnet',
    short: 'Testnet',
    realFunds: false,
    chain: {
      id: 5042002,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
      rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
      blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
    },
    // Wallet add/switch params, unchanged from the original app.
    wallet: {
      chainId: '0x4cef52', // 5042002
      addParams: {
        chainId: '0x4cef52',
        chainName: 'Arc Testnet',
        nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
        rpcUrls: ['https://rpc.testnet.arc.network'],
        blockExplorerUrls: ['https://testnet.arcscan.app'],
      },
    },
    explorer: 'https://testnet.arcscan.app',
    contracts: {
      escrow: '0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4',
      usdc: '0x3600000000000000000000000000000000000000',
      identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    },
    features: { circleAgentWallets: true, faucet: 'https://faucet.circle.com' },
  },

  mainnet: {
    key: 'mainnet',
    label: 'Arc Mainnet',
    short: 'Mainnet',
    realFunds: true,
    chain: {
      id: 5042,
      name: 'Arc',
      // Native USDC is 18 decimals. App logic uses the 6-decimal ERC-20 view.
      nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://rpc.mainnet.arc.io'] },
      },
      blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
    },
    // Ordered fallback list for reads. Provider keys must be domain-restricted
    // and supplied via env (VITE_ARC_MAINNET_RPC_EXTRA, comma separated).
    rpcFallbacks: [
      'https://rpc.mainnet.arc.io',
      'https://rpc.blockdaemon.mainnet.arc.io',
      'https://rpc.drpc.mainnet.arc.io',
      'https://rpc.quicknode.mainnet.arc.io',
    ],
    wallet: {
      chainId: '0x13b2', // 5042
      addParams: {
        chainId: '0x13b2',
        chainName: 'Arc',
        nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
        rpcUrls: ['https://rpc.mainnet.arc.io'],
        blockExplorerUrls: ['https://explorer.arc.io'],
      },
    },
    explorer: 'https://explorer.arc.io',
    contracts: {
      // `escrow` stays null until the V2 app adapter exists. While null, every protocol page is
      // gated and wallet writes are blocked, so the V1 (testnet) ABI is never pointed at V2.
      escrow: null,
      // Deployed and source-verified on Arc mainnet (see contracts-v2/DEPLOYMENTS.md).
      v2: {
        kernel: '0x7342462dF8373a84e7d8F0E5336E3730c6a0fCC5',
        router: '0x483EB91ad48387210B9DD92301Cc99B86e6d4815',
        board: '0x74082C582Dac7074938A2c06b5F4a02f9e9622A6',
      },
      usdc: '0x3600000000000000000000000000000000000000',
      // From project research; verify on-chain before enabling writes.
      identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    },
    // Floor enforced by the fee market; txs below it are silently dropped.
    minMaxFeePerGas: 20_000_000_000n,
    features: { circleAgentWallets: false, faucet: null },
  },
}

const STORAGE_KEY = 'agentboard.network'
const listeners = new Set()

function envDefault() {
  const v = import.meta.env?.VITE_DEFAULT_NETWORK
  return NETWORK_KEYS.includes(v) ? v : 'testnet'
}

function readInitial() {
  try {
    const q = new URLSearchParams(window.location.search).get('network')
    if (NETWORK_KEYS.includes(q)) return q
  } catch { /* non-browser */ }
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (NETWORK_KEYS.includes(s)) return s
  } catch { /* storage blocked */ }
  return envDefault()
}

let active = readInitial()

export function getActiveNetworkKey() { return active }
export function getActiveNetwork() { return NETWORKS[active] }
// Mainnet V2 (AgentKernel + EvaluatorRouter + JobBoard) is on by default. Set VITE_MAINNET_V2=0 on the
// host to switch the mainnet side back to the "launch in progress" gate. `contracts.mainnet.escrow`
// stays null on purpose: it is the V1 slot, and a non-null value would point the V1 testnet ABI at
// V2 contracts.
export function isV2Enabled() {
  return import.meta.env?.VITE_MAINNET_V2 !== '0'
}

/** Which protocol implementation serves a network: 'v1' (testnet escrow), 'v2' (mainnet), or null (gated). */
export function protocolFor(key = active) {
  if (key === 'testnet') return 'v1'
  if (NETWORKS.mainnet.contracts.escrow) return 'v1'
  return isV2Enabled() ? 'v2' : null
}

export function isProtocolLive(key = active) { return protocolFor(key) !== null }

export function setActiveNetworkKey(key) {
  if (!NETWORK_KEYS.includes(key) || key === active) return
  active = key
  try { localStorage.setItem(STORAGE_KEY, key) } catch { /* ignore */ }
  listeners.forEach(fn => fn())
}

export function subscribeNetwork(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function explorerUrl(path = '', key = active) {
  return `${NETWORKS[key].explorer}${path}`
}
