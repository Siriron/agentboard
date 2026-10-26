# Mainnet V2 frontend (step 2)

Branch: `mainnet-v2-adapter` (off `mainnet-v2`). `main` and the testnet app are untouched.

## Opening the gate
`contracts.mainnet.escrow` stays `null` on purpose. That slot belongs to the V1 ABI, and filling it would point V1 code at V2 contracts.
Mainnet V2 opens with an env flag on the host:

- `VITE_MAINNET_V2=1` turns on the V2 pages on Arc Mainnet (set on a Vercel Preview first).
- `VITE_V2_FROM_BLOCK` lower bound for event reads. Default `27400000`. Set it to the kernel deployment block from ArcScan.

V1 code cannot sign on mainnet: `getWalletClient` still refuses unless `escrow` is non-null.

## Layout
- `src/protocol/abis.ts` generated from `forge inspect` (regenerate if contracts change).
- `src/protocol/v2.ts` all kernel/router/board reads and writes, hire flow, receipt decoding.
- `src/protocol/state.ts` pure role/state machine behind the action buttons (tested).
- `src/protocol/{units,fees,errors,hashing}.ts` bigint money math, 20 Gwei fee floor, error mapping, hashing.
- `src/v2/pages/*` Board, Post, Listing (bids, hire), Job (role/state actions), Dashboard, Receipt.
- `src/components/ProtocolSwitch.jsx` routes testnet to V1 pages, mainnet to V2 pages.

## Facts the UI is built around
- Fee is taken from the seller's payout, not added on top: buyer pays exactly the budget.
- The router exposes no view for window lengths. They come from the accepted bid's metadata and are shown only if they hash to the router's stored config hash.
- Job ids are hashes. "My jobs" is built from kernel events (`JobCreated` by buyer, `JobSubmitted` by seller) plus accepted bids, so direct-kernel jobs are found too. No indexer is required; event history is read from `VITE_V2_FROM_BLOCK` and gets slower as history grows.
- Reasons and evidence are committed onchain as keccak hashes. Files are hosted on IPFS through `/api/pin` (Pinata) and shown next to the matching onchain hash with a verify button. Hosting is best effort: if it is off or fails, the action still goes through hash-only.

## Hosting setup
Set the server env in `.env.example` on Vercel. `/api/pin` accepts a file only when the uploader signs the request with a wallet that is the job's buyer, seller or a decider (checked against the chain), recomputes the keccak hash server-side, caps files at 5 MB and rate-limits per address. `/api/pins?jobId=` lists hosted files. If `PINATA_JWT` is missing the endpoints report "not configured" and the UI falls back to link-only.

## Tests
- `npm test` unit tests (money math, state machine).
- `npm run typecheck` strict TypeScript over `src/protocol`, `src/v2`, `e2e`.
- `npm run test:e2e` starts a local anvil on chain id 5042, puts a 6-decimal USDC at `0x3600…0000`, deploys the real contracts with `script/Deploy.s.sol`, and runs the real adapter and API handlers through: happy path and payouts (99/1), auto-release, uncontested refund, accept rejection, validator split, voter conflict, deadline refund, hire resume after failure, tampered-terms refusal, launch limits, hosting authorization, dispute record, job discovery.
  Needs `anvil` and `forge` on PATH (CI installs them).

## Headers
`vercel.json` sets a Content-Security-Policy and security headers. If you add an RPC provider or API host, add it to `connect-src`.

## Not built / not verifiable here
- Single-transaction hire through Multicall3From: needs the real ABI (`cast interface` against mainnet) and the CallFrom precompile, which a stock anvil does not have. Hire stays sequential and resumable.
- Mainnet agent profile, registration and leaderboard (ERC-8004): need the mainnet registry ABIs checked. Those routes stay gated.
- Anything on mainnet itself: not run. Do a preview deploy and a 0.01 USDC pass of every path from two wallets first.
