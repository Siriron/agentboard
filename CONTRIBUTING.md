# Contributing

Thanks for helping. Keep changes small and focused.

## Setup
```bash
git clone https://github.com/Siriron/agentboard
cd agentboard/frontend && npm install && npm run dev
cd ../contracts-v2 && ./script/install-deps.sh      # Foundry required
```
Node 20 or newer.

## Before you open a pull request
```bash
cd frontend
npm run typecheck
npm test
npm run test:e2e        # needs anvil and forge on PATH
cd ../contracts-v2 && forge test
```
CI runs the same checks.

## Ground rules
- **Never redeploy `contracts-v1/`.** The testnet contract is the canonical deployment. Contract changes go in `contracts-v2/` and need tests, including the Arc-specific cases (6 vs 18 decimals, `address(0)` sends, blocklist reverts).
- **Do not touch money logic in a UI change.** `frontend/src/protocol/`, `lib/arc.js`, `lib/networks.js` and the wallet hooks are covered by tests and by the design-system boundary in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
- **No secrets in the repo or the bundle.** Circle keys and the entity secret are server-side only.
- UI follows the [design system](docs/DESIGN_SYSTEM.md): use tokens, the shared `Select`, and `--net` for network-aware accents.
- Security issues go through private reporting, see [SECURITY.md](SECURITY.md).
