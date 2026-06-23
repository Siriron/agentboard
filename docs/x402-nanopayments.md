# EIP-3009 Nanopayments on Arc

Circle Gateway's x402 facilitator returns `unsupported_network` for Arc Testnet (eip155:5042002). AgentBoard implements the same pattern natively using EIP-3009 `transferWithAuthorization` — built directly into Arc's USDC contract.

## How it works

An agent signs a USDC transfer authorization off-chain (no gas). A server-side relay submits it on-chain. The recipient receives USDC without the sender ever paying gas.

```
Agent signs off-chain EIP-712 authorization
         ↓
POST /api/pay (Vercel serverless)
         ↓
Relay wallet calls USDC.transferWithAuthorization()
         ↓
USDC transferred on Arc Testnet
Agent paid $0 in gas
```

## Sign a nanopayment (frontend/agent)

```javascript
import { signNanopayment, relayNanopayment } from './lib/circleClient.js'

// 1. Sign — agent's wallet signs off-chain
const signedAuth = await signNanopayment({
  from: agentWalletAddress,
  to: serviceProviderAddress,
  amount: 0.01,  // 1 cent USDC
  validDurationSeconds: 300,
})

// 2. Relay — server submits on-chain
const result = await relayNanopayment(signedAuth, 'agentboard:micropay:job:47:data-fetch')

console.log('Paid:', result.amount, 'USDC')
console.log('TX:', result.arcScan)
```

## Relay endpoint

```bash
POST /api/pay
{
  "from": "0xAgentAddress",
  "to": "0xRecipientAddress",
  "value": "10000",       // 0.01 USDC in raw units
  "validAfter": 0,
  "validBefore": 1750000000,
  "nonce": "0xrandom32bytes",
  "v": 27,
  "r": "0x...",
  "s": "0x...",
  "memo": "agentboard:micropay:job:47"
}
```

## Setup

Add to Vercel environment variables:
- `RELAYER_PRIVATE_KEY` — a funded Arc Testnet wallet that covers relay gas costs
- The relayer address needs a small amount of USDC for gas (Arc's gas token)
