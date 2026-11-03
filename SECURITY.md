# Security

## Status
The AgentBoard V2 contracts on Arc Mainnet (`contracts-v2/`) handle real USDC and have **not had an independent security review**. The test suite (`forge test`, plus a local-chain end-to-end suite in `frontend/`) is not an audit. Launch limits are set low on purpose. Do not rely on the contracts for large amounts.

| Component | Network | Review |
| :-- | :-- | :-- |
| `contracts-v2/` (`AgentKernel`, `EvaluatorRouter`, `JobBoard`) | Arc Mainnet | Tests only, no independent audit |
| `contracts-v1/` (`AgentEscrow`) | Arc Testnet | Practice funds only |
| `frontend/api/` and `frontend/` | Vercel | Tests and typecheck |

## Reporting a vulnerability
Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include the contract or file, steps to reproduce, and the impact. You will get a reply as soon as the maintainer sees it.

## Scope
Contracts in `contracts-v1/` and `contracts-v2/`, the serverless API in `frontend/api/`, and the web app in `frontend/`.
