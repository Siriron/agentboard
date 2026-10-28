# Mainnet V2 frontend (step 2)

Branch: `mainnet-v2-adapter` (off `mainnet-v2`). `main` and the testnet app are untouched.

## Opening the gate
`contracts.mainnet.escrow` stays `null` on purpose. That slot belongs to the V1 ABI, and filling it would point V1 code at V2 contracts.
Mainnet V2 is on by default; testnet is unchanged and the Testnet/Mainnet switch picks the network.

- `VITE_MAINNET_V2=0` turns the mainnet side back into the "launch in progress" gate.
- `VITE_V2_FROM_BLOCK` lower bound for event reads. Default `27766000` (kernel created in block 27767558).

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
- Reasons and evidence are committed onchain as keccak hashes. Files (4 MB max) are hosted in Vercel Blob through `/api/upload` and shown next to the matching onchain hash with a verify button. Hosting is best effort: if it is off or fails, the action still goes through hash-only.

## Hosting setup
One step: in the Vercel project open Storage, create a Blob store and connect it. Vercel adds `BLOB_READ_WRITE_TOKEN` itself. No other account or env var is needed (the mainnet contract addresses are built in; `V2_KERNEL`, `V2_ROUTER`, `ARC_MAINNET_RPC` can override them).
`/api/upload` accepts a file only when the uploader signs the request with a wallet that is the job's buyer, seller or a decider (checked against the chain), recomputes the keccak hash server-side, caps files at 4 MB and rate-limits per address. Files are served as opaque downloads. `/api/files?jobId=` lists them. Without a Blob store the endpoints report "not configured" and the UI falls back to a plain https link for deliverables and hash-only for evidence.

## Tests
- `npm test` unit tests (money math, state machine).
- `npm run typecheck` strict TypeScript over `src/protocol`, `src/v2`, `e2e`.
- `npm run test:e2e` starts a local anvil on chain id 5042, puts a 6-decimal USDC at `0x3600…0000`, deploys the real contracts with `script/Deploy.s.sol`, and runs the real adapter and API handlers through: happy path and payouts (99/1), auto-release, uncontested refund, accept rejection, validator split, voter conflict, deadline refund, hire resume after failure, tampered-terms refusal, launch limits, hosting authorization, dispute record, job discovery.
  Needs `anvil` and `forge` on PATH (CI installs them).

## Headers
`vercel.json` sets a Content-Security-Policy and security headers. If you add an RPC provider or API host, add it to `connect-src`.

## Hire: one transaction, with fallback
Hire first tries a single transaction through `Multicall3From.aggregate3` (allowance, create, terms, price, fund), which keeps the buyer's wallet as `msg.sender` via Arc's CallFrom precompile. The batch is simulated first. If the simulation or the transaction fails for any reason other than the user rejecting it, nothing was applied (the batch is atomic) and the older sequential, resumable flow runs instead. Contract wallets cannot use the batch (EOA-only) and always use the sequential flow. Interface source: `circlefin/arc-node`, `contracts/src/batch/IMulticall3From.sol`.

## Agents (ERC-8004)
`/register` mints an identity (`register(string)`) with a small onchain JSON profile; `/agent/<id>` shows identity and reputation (`getClients`, `getSummary`). Signatures come from Arc's ERC-8004 quickstart and the reference contracts. A leaderboard is not built.

## Not verified here
- Nothing has run against Arc mainnet. The batched hire path and the agent pages cannot run on a stock anvil (no CallFrom precompile, no ERC-8004 registries), so they are covered by typecheck and, for the batch, by the simulate-then-fallback design, not by tests.
- Test the deployed app and send me anything that looks wrong.
