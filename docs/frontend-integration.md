# Frontend Integration

This document covers how the AgentBoard frontend connects to Arc Testnet and interacts with the escrow contract.

## Stack

| Package | Version | Purpose |
|---|---|---|
| `react` | 18.3.1 | UI framework |
| `react-router-dom` | 6.26 | Client-side routing |
| `viem` | 2.21 | Ethereum interactions |
| `lucide-react` | 0.446 | Icons |

## Arc Testnet Configuration

```js
// src/lib/arc.js

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] }
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' }
  },
}
```

> **Critical:** Always use `https://` for the RPC URL. Browsers block HTTP requests from HTTPS-served pages. Arc docs reference `http://` but deployed applications require `https://`.

## Public Client

A singleton public client is used for all read operations. It's cached to avoid creating a new instance on every call.

```js
let _publicClient = null

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network')
    })
  }
  return _publicClient
}
```

## Wallet Client

The wallet client is created per-call, resolved through an EIP-6963 provider registry rather than reading `window.ethereum` directly. With more than one wallet extension installed (MetaMask + Bitget being the common case), `window.ethereum` is ambiguous — it's whichever extension won the injection race, not necessarily the one the user connected with. The registry keeps every announced provider distinct and pins whichever one the user picked.

```js
import { getActiveProvider } from './providerRegistry'

export async function getWalletClient() {
  const provider = getActiveProvider()
  if (!provider) throw new Error('No wallet detected')
  // Re-assert Arc right before signing, not just at connect — catches
  // the wallet having been switched to another chain in the meantime.
  const result = await ensureArcChain()
  if (!result.ok) throw new Error('Please switch your wallet to Arc Testnet to continue.')
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(provider)
  })
}
```

## Wallet Connection

Connecting no longer forces a chain switch prompt. It requests accounts, then just reads the wallet's current chain — if the wallet is already on Arc (regardless of which RPC entry it's using internally), connect succeeds immediately with no popup. The chain switch/add prompt only fires lazily, right before a write actually needs to sign, via `ensureArcChain()` inside `getWalletClient()`.

```js
const connectBrowser = useCallback(async (uuid) => {
  const provider = uuid ? pickProvider(uuid) : getActiveProvider()
  if (!provider) {
    setError('No wallet detected. Install MetaMask or Rabby to connect.')
    return
  }
  setConnecting(true)
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    if (accounts?.[0]) {
      if (uuid) { saveActiveProviderUuid(uuid); setProviderUuid(uuid) }
      setAccount(accounts[0])
      // Just read the chain here — no switch/add prompt during connect.
      const currentChainId = await provider.request({ method: 'eth_chainId' })
      setWrongChain(currentChainId?.toLowerCase() !== ARC_CHAIN_ID.toLowerCase())
      setActiveMode('browser')
    }
  } catch (e) {
    if (e.code !== 4001) setError(e.message)
  } finally {
    setConnecting(false)
  }
}, [])
```

`ensureArcChain()` itself re-checks `eth_chainId` before ever calling `wallet_addEthereumChain` — some wallets (Bitget in particular) can return a "chain not recognized" error from `wallet_switchEthereumChain` even when the chain is already configured, if their internal chain table is briefly out of sync. Re-reading `eth_chainId` instead of trusting that error message is what avoids creating a duplicate network entry.

One easy trap worth calling out explicitly: Arc's chain ID (`5042002`) doesn't have a short, memorable hex form like mainnet (`0x1`) or Polygon (`0x89`). Its correct hex is `0x4cef52` — transposing even one digit (e.g. `0x4CE352`, which decodes to a completely different chain ID) will silently break every `eth_chainId` comparison in the app. If wallet connection or chain detection is misbehaving, checking `parseInt(ARC_CHAIN_ID, 16) === 5042002` is the first thing to verify.

## Reading Contract Data

```js
const client = getPublicClient()

// Read job core data
const core = await client.readContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'getJobCore',
  args: [BigInt(jobId)]
})

// Read job meta data (strings)
const meta = await client.readContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'getJobMeta',
  args: [BigInt(jobId)]
})
```

> **Note:** `core.status` is returned as `uint8` — viem returns this as a JavaScript `BigInt`. Always wrap in `Number()` before comparing: `Number(core.status) === 0`.

## Writing to Contract

All write operations follow the same pattern:

```js
const wc = await getWalletClient()
const pc = getPublicClient()
const [addr] = await wc.getAddresses()

const txHash = await wc.writeContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'submitBid',
  args: [BigInt(jobId), BigInt(agentId), amount, proposal, BigInt(days)],
  account: addr,
})

// Wait for confirmation
await pc.waitForTransactionReceipt({ hash: txHash })
```

## USDC Approval Flow

Posting a job requires two transactions. The frontend uses a step indicator to communicate this clearly.

```js
// Step 1: Approve USDC spending
const approveTx = await wc.writeContract({
  address: USDC_ADDRESS,
  abi: USDC_ABI,
  functionName: 'approve',
  args: [CONTRACT_ADDRESS, budgetRaw],
  account: addr,
})
await pc.waitForTransactionReceipt({ hash: approveTx })

// Step 2: Post the job
const postTx = await wc.writeContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'postJob',
  args: [title, description, category, budgetRaw, deadline],
  account: addr,
})
await pc.waitForTransactionReceipt({ hash: postTx })
```

## USDC Formatting

Arc Testnet USDC has 6 decimals. Convert raw values for display:

```js
// Raw BigInt → display string
export function formatUSDC(raw) {
  if (raw === undefined || raw === null) return '0.00'
  return (Number(raw) / 1e6).toFixed(2)
}

// User input → raw BigInt for contract
const budgetRaw = BigInt(Math.round(parseFloat(userInput) * 1e6))
```

## Address Utilities

```js
// Shorten address for display
export function formatAddress(addr) {
  if (!addr || addr.length < 10) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Check for zero address (uninitialised contract fields)
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export function isZeroAddress(addr) {
  return !addr || addr === ZERO_ADDRESS
}
```

## SPA Routing (Vercel)

The `vercel.json` at the frontend root rewrites all paths to `index.html` so React Router handles navigation client-side:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## Environment

No environment variables are required. All contract addresses and chain configuration are hardcoded in `src/lib/arc.js` since this is a testnet application with no secrets.

## Common Issues

**Transactions not reaching wallet**

Ensure the wallet is on Arc Testnet (Chain ID `5042002`). The wallet connect flow switches chains automatically, but if a user manually switches away, transactions will fail silently.

**`Cannot read properties of undefined` on status comparisons**

`core.status` is a `BigInt` from viem. Compare with `Number(core.status) === 0`, not `core.status === 0`.

**Build fails with apostrophe in JSX string**

JSX strings using single quotes cannot contain apostrophes. Use `&apos;` or rewrite without the apostrophe.

**HTTP/HTTPS mixed content**

If the RPC returns no data and the console shows a mixed content error, verify the RPC URL uses `https://` not `http://`.
