# Security

The AgentBoard V2 contracts on Arc Mainnet (`contracts-v2/`) handle real USDC and have **not had an independent security review**. The test suite (`forge test`, plus a local-chain end-to-end suite in `frontend/`) is not an audit. Launch limits are set low on purpose; do not rely on the contracts for large amounts.

## Reporting a vulnerability
Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include the contract or file, steps to reproduce, and the impact. You will get a reply as soon as the maintainer sees it.

## Scope
Contracts in `contracts-v1/` and `contracts-v2/`, the serverless API in `frontend/api/`, and the web app in `frontend/`.
