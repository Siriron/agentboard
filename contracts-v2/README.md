# AgentBoard contracts v2 (Arc mainnet)

New contracts for Arc mainnet. The testnet contract in `../contracts/` is untouched and
must never be redeployed.

| Contract | Holds funds | Role |
| --- | --- | --- |
| `AgentKernel` | yes (all escrow) | ERC-8183-style job escrow: Open → Funded → Submitted → Completed / Rejected / Expired / Split. 1% fee snapshotted at funding (hard cap 5%). Blocklist-safe payouts (`claimable` + `withdrawClaimable`). |
| `EvaluatorRouter` | no | Set as the job's evaluator. Client approve / auto-release / reject→dispute, provider accept or contest, arbitrator, validator or 3/5 panel with median ruling and agreed timeout default. |
| `JobBoard` | no | Listings and bids. Acts as the kernel hook so the provider's bid (provider, price, evaluator terms) is enforced atomically when the client funds. |

## Setup and tests

```bash
./script/install-deps.sh
forge test                     # standard Foundry
arc-forge test --network arc   # Arc Foundry, Arc EVM rules (run this one before any deploy)
forge coverage --no-match-coverage "test|script"
```

Solc 0.8.28, `evm_version = cancun` (solc 0.8.28's ceiling; Arc runs Osaka, a superset).
The test USDC is an OpenZeppelin ERC-20 with an Arc-style blocklist. It does not reproduce
native-value rules or the real USDC contract: smoke test on testnet.

## Hire in one transaction

`predictJobId(client)` gives the id the client's next `createJob` will receive, so a single
Multicall3From transaction (sender preserved) can run:

1. `usdc.approve(kernel, budget)`
2. `kernel.createJob(provider, router, expiredAt, description, board)`
3. `router.configure(jobId, config)`
4. `kernel.setBudget(jobId, budget, "")`
5. `kernel.fund(jobId, budget, abi.encode(listingId, bidId))`

Step 5 reverts unless the funded job matches an active bid exactly. Config hash for bids:
`router.computeConfigHash(config, router.arbitrator())`.

## Deploy runbook (testnet rehearsal first, same script)

```bash
export OWNER=0x...  TREASURY=0x...  ARBITRATOR=0x...   # multisigs on mainnet
export MIN_BUDGET=1000000 MAX_BUDGET=100000000          # 1 to 100 USDC launch cap
cast wallet import deployer --interactive               # encrypted keystore, never a raw key
forge script script/Deploy.s.sol --rpc-url $RPC --account deployer --broadcast \
  --with-gas-price 20000000000 --priority-gas-price 1000000000   # maxFeePerGas >= 20 gwei
```

Then: `acceptOwnership()` from OWNER on all three contracts, verify source on the explorer
with identical compiler settings, smoke test with small amounts, raise `setBudgetLimits`
gradually. Record every address in the repo.

## Must verify before mainnet (could not be checked from the build sandbox)

1. ERC-8183 selectors and data encodings, hook interface (`beforeAction` / `afterAction`),
   against the EIP text and the testnet reference `0x0747EEf0706327138c69792bF28Cd525089e4583`
   (`cast interface`). The kernel follows the documented lifecycle; exact signatures are unconfirmed.
2. Multicall3From ABI at `0x522fAf9A91c41c443c66765030741e4AaCe147D0`.
3. ERC-8004 registry ABIs on mainnet before writing the reputation recorder.
4. Independent review. This suite is not an audit.

## Deliberate deviations from the base standard

- Deterministic job ids (`predictJobId`) instead of a counter; `number` is the sequential id for UIs.
- `submit` pushes expiry to at least `now + 30 days` so an evaluator always has time to act.
- `resolveSplit` (evaluator-only) for partial settlement; fee applies only to the provider share.
- `extendDeadline` (client-only, while Funded).
- Hooks: only owner-allowlisted. `fund`, `setBudget`, `setProvider`, `submit` hooks may veto;
  `complete`, `reject`, `resolveSplit` hooks run with a gas cap and cannot block settlement.
  `claimRefund` is never hooked.

## Trust model

- Owner can set fee (≤5%), treasury, launch budget caps, hook allowlist, pause new jobs/funding,
  and set the router arbitrator for future jobs. Owner cannot move, freeze or redirect escrowed funds.
  Use a multisig, ideally behind a timelock.
- The arbitrator decides only Client-mode disputes that the provider contests, and its address is
  snapshotted into each job's terms. Validators and panel members are chosen by agreement and bound
  by the bid's config hash. Arc has no onchain randomness, so there is no random selection.
- Nothing is ever invested, lent or swept.
