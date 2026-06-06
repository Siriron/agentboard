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

The wallet client is created per-call using the browser's injected provider (MetaMask).

```js
export async function getWalletClient() {
  if (!window.ethereum) throw new Error('No wallet detected')
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum)
  })
}
```

## Wallet Connection

The wallet connection flow requests accounts first, then adds/switches to Arc Testnet silently.

```js
const connect = useCallback(async () => {
  if (!window.ethereum) {
    alert('Please install MetaMask.')
    return
  }
  setConnecting(true)
  try {
    // Step 1: request accounts (triggers MetaMask popup)
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })
    if (accounts?.[0]) {
      setAccount(accounts[0])
      // Step 2: switch/add Arc chain silently
      await ensureArcChain()
    }
  } catch (e) {
    if (e.code !== 4001) console.error(e)
  } finally {
    setConnecting(false)
  }
}, [])
```

`eth_requestAccounts` must come before `wallet_switchEthereumChain`. MetaMask will not switch chains until an account is connected.

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
