import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GlobalSetupContext } from 'vitest/node'

const PORT = 8555
const RPC = `http://127.0.0.1:${PORT}`
const CONTRACTS = resolve(__dirname, '../../contracts-v2')
// Well-known anvil dev keys (public, local only).
const KEYS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
]
let anvil: ChildProcess | null = null

async function rpc(method: string, params: unknown[] = []) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = (await r.json()) as { result?: unknown; error?: { message: string } }
  if (j.error) throw new Error(j.error.message)
  return j.result
}

export async function setup({ provide }: GlobalSetupContext) {
  anvil = spawn('anvil', ['--chain-id', '5042', '--port', String(PORT), '--silent'], { stdio: 'ignore' })
  for (let i = 0; i < 50; i++) { try { await rpc('eth_chainId'); break } catch { await new Promise(r => setTimeout(r, 200)) } }

  // 6-decimal USDC stand-in at the real Arc address (the ERC-20 view).
  const code = execFileSync('forge', ['inspect', 'test/mocks/MockUSDC.sol:MockUSDC', 'deployedBytecode', '--offline'], { cwd: CONTRACTS }).toString().trim()
  await rpc('anvil_setCode', ['0x3600000000000000000000000000000000000000', code])

  const accounts = (await rpc('eth_accounts')) as string[]
  const env = {
    ...process.env, OWNER: accounts[0], TREASURY: accounts[9], ARBITRATOR: accounts[8], MIN_BUDGET: '10000', MAX_BUDGET: '1000000000',
  }
  execFileSync('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--private-key', KEYS[0]!, '--broadcast', '--offline'], { cwd: CONTRACTS, env, stdio: 'pipe' })
  const run = JSON.parse(readFileSync(resolve(CONTRACTS, 'broadcast/Deploy.s.sol/5042/run-latest.json'), 'utf8')) as { transactions: { contractName: string; contractAddress: string }[] }
  const addr = (n: string) => run.transactions.find(t => t.contractName === n)!.contractAddress
  provide('deployment', { rpc: RPC, kernel: addr('AgentKernel'), router: addr('EvaluatorRouter'), board: addr('JobBoard'), accounts })
}

export async function teardown() {
  anvil?.kill()
  rmSync(resolve(CONTRACTS, 'broadcast'), { recursive: true, force: true })
}

declare module 'vitest' {
  export interface ProvidedContext { deployment: { rpc: string; kernel: string; router: string; board: string; accounts: string[] } }
}
