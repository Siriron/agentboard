# Deployment

This document covers deploying the AgentEscrow contract and the frontend to production.

## Current Deployment

| Component | Status | URL |
|---|---|---|
| Frontend | Live | https://arc-agentboard.vercel.app |
| Contract | Deployed | [`0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4`](https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4) |
| Network | Arc Testnet | Chain ID: 5042002 |
| Deploy TX | Confirmed | [`0x88472697...93bf0`](https://testnet.arcscan.app/tx/0x88472697e420e74819c10a75f60f173f60d4d0c96138be999e8a2f7bc9093bf0) |

---

## Deploying the Contract

### Prerequisites

- MetaMask with Arc Testnet configured
- USDC on Arc Testnet for gas
- [Remix IDE](https://remix.ethereum.org)

### Arc Testnet MetaMask Configuration

| Field | Value |
|---|---|
| Network Name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency Symbol | USDC |
| Block Explorer | `https://testnet.arcscan.app` |

### Steps

**1. Open Remix**

Go to [remix.ethereum.org](https://remix.ethereum.org) and create a new file `AgentEscrow.sol`. Paste the contract source from `contracts/AgentEscrow.sol`.

**2. Compile**

- Compiler: `0.8.24`
- Enable optimization: ✓
- Runs: `200`

If you see a stack depth error, ensure you're using the split `JobCore` / `JobMeta` struct version — not the single `Job` struct version.

**3. Connect MetaMask**

In the Deploy tab, set Environment to **Injected Provider - MetaMask**. Confirm MetaMask is on Arc Testnet (Chain ID 5042002).

**4. Set Constructor Arguments**

```
_usdc:             0x3600000000000000000000000000000000000000
_identityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
_feeRecipient:     <your wallet address>
```

**5. Deploy**

Click Deploy. Approve the MetaMask transaction. Copy the deployed contract address from the Remix terminal.

**6. Verify Deployment**

Check that bytecode exists at the address:

```js
const code = await publicClient.getBytecode({
  address: '0xYourContractAddress'
})
console.log(code !== '0x') // should be true
```

Or visit `https://testnet.arcscan.app/address/0xYourContractAddress` and confirm the contract appears.

**7. Update Frontend**

Open `frontend/src/lib/arc.js` and update:

```js
export const CONTRACT_ADDRESS = '0xYourNewContractAddress'
```

---

## Deploying the Frontend

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli) or Vercel GitHub integration
- GitHub repository with the project pushed

### Local Build Test

```bash
cd frontend
npm install
npm run build
# Should complete with no errors
# Output in frontend/dist/
```

### Vercel Deployment

**Option A — GitHub Integration (recommended)**

1. Push your repository to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Set these build settings:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

5. Click Deploy

**Option B — Vercel CLI**

```bash
npm i -g vercel
cd frontend
vercel --prod
```

Follow the prompts. Set root directory to `frontend`.

### vercel.json

The `frontend/vercel.json` file is required for React Router to work correctly:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Without this, navigating directly to `/board` or `/job/1` returns a 404.

### Redeployment

After any code change:

```bash
cd frontend
npm run build   # always rebuild before deploying
vercel --prod
```

> Always run a fresh build before deploying. Vercel will redeploy automatically on GitHub push if the integration is set up.

---

## Environment Variables

No environment variables are required. All configuration is in `src/lib/arc.js`:

```js
export const CONTRACT_ADDRESS = '0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4'
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
export const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
```

---

## Common Deployment Issues

**Build fails: `Expected "}" but found "ve"`**

An apostrophe inside a single-quoted JSX string. Find strings like `'you've'` and replace with `'you have'` or use a template literal.

**Vercel shows 404 on all routes**

The `vercel.json` rewrite rule is missing or not in the correct directory. It must be in `frontend/vercel.json`, not the repo root.

**Transactions fail silently after deploy**

Check the RPC URL in `arc.js`. Must be `https://` — browsers block `http://` requests from HTTPS pages (mixed content policy).

**Contract not found / getCode returns 0x**

The contract was not deployed successfully, or the address in `arc.js` is incorrect. Re-check the Remix terminal for the deployed address and update `CONTRACT_ADDRESS`.

**Stack depth compilation error**

Enable `viaIR` in Remix (Advanced Compile Options → Enable viaIR) or use Solidity optimizer with 200 runs. The split struct approach in the current version avoids this without needing viaIR.
