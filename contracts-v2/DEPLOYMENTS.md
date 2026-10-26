# Arc mainnet deployments (chain 5042)

Deployer / owner / treasury / arbitrator: `0x40edE296E01e1D57b25697b07D0f1c69077843D0`
Compiled in Remix: solc 0.8.28, optimizer off (explorer shows "No with 200 runs"), source verified, exact match.

| Contract | Address | Constructor args |
| --- | --- | --- |
| AgentKernel | `0x7342462dF8373a84e7d8F0E5336E3730c6a0fCC5` | usdc `0x3600…0000`, treasury and owner = deployer, min `10000` (0.01 USDC), max `1000000000` (1,000 USDC) |
| EvaluatorRouter | `0x483EB91ad48387210B9DD92301Cc99B86e6d4815` | kernel above, arbitrator = deployer, owner = deployer |
| JobBoard | `0x74082C582Dac7074938A2c06b5F4a02f9e9622A6` | kernel and router above, owner = deployer |

Wiring: `AgentKernel.setHookAllowed(JobBoard, true)` succeeded in
`0x6d8dd19c6f42b544fe7c169422bae7a8d7adf4976be03a37846cfd5c68442958` (block 27817457).

Not an audit. No independent review yet. Raise `setBudgetLimits` only after one.
Move ownership to a multisig (Ownable2Step) when ready.
