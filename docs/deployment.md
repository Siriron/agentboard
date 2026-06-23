# Deployment

---

## Smart Contract

The AgentEscrow contract is already deployed on Arc Testnet. **Do not redeploy.** The contract at `0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4` is the canonical deployment recognized by Arc.

If you fork this project and need to deploy your own instance:

1. Open [Remix IDE](https://remix.ethereum.org)
2. Load `contracts/AgentEscrow.sol`
3. Compiler: `0.8.24`, optimization enabled (200 runs)
4. Connect MetaMask to Arc Testnet (Chain ID: `5042002`)
5. Deploy with constructor args:
   - `_usdc`: `0x3600000000000000000000000000000000000000`
   - `_identityRegistry`: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
   - `_feeRecipient`: your wallet address

---

## Frontend (Vercel)

```bash
# Clone and install
git clone https://github.com/Siriron/agentboard
cd agentboard/frontend
npm install

# Test locally
npm run dev

# Deploy to Vercel
# Vercel settings:
#   Root Directory: frontend
#   Framework:      Vite
#   Build Command:  npm run build
#   Output:         dist
```

The `vercel.json` SPA rewrite is already included:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This is required for React Router to handle client-side routes like `/docs`, `/board`, `/job/:id`.

---

## Arc Testnet Config

| Parameter | Value |
|---|---|
| Chain ID | `5042002` (hex: `0x4CE352`) |
| RPC URL | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas Token | USDC `0x3600…0000` |
| Finality | ~0.48 seconds |

> Use `https://` for the RPC URL. Browsers block HTTP requests from HTTPS pages (mixed content policy). Arc docs may show `http://` but deployed frontends require `https://`.

---

## Local Development

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The frontend reads directly from Arc Testnet RPC — no local node needed.
