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
- Job ids are hashes. Jobs are reached from a listing, a link or the dashboard (board jobs only). A direct-kernel job needs an indexer.
- Reasons and evidence exist onchain as hashes only. Hosting those files (IPFS pinning) is not built.

## Not verified
Nothing here has been run against mainnet. Before opening the gate: preview deploy, tiny-amount run of every path from two wallets, and `cast interface` on Multicall3From before moving the hire flow to one batched transaction.
