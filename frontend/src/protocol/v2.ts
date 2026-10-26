// Browser binding for the V2 adapter. All logic lives in v2core.ts.
import { createWalletClient, custom, type Address } from 'viem'
import { getActiveNetwork, getActiveNetworkKey, NETWORKS } from '../lib/networks'
import { getPublicClient } from '../lib/arc'
import { ensureArcChain } from '../hooks/useWallet'
import { getActiveProvider } from '../lib/providerRegistry'
import { AppError } from './errors'
import { configureV2, type V2Env, type WalletLike } from './v2core'

const env: V2Env = {
  apiBase: '',
  fromBlock: BigInt((import.meta.env?.VITE_V2_FROM_BLOCK as string | undefined) || '27400000'),
  addresses: () => {
    const c = NETWORKS.mainnet.contracts as { v2: { kernel: string; router: string; board: string }; usdc: string }
    return { kernel: c.v2.kernel as Address, router: c.v2.router as Address, board: c.v2.board as Address, usdc: c.usdc as Address }
  },
  client: () => {
    if (getActiveNetworkKey() !== 'mainnet') throw new AppError('AgentBoard V2 runs on Arc Mainnet. Switch network to continue.')
    return getPublicClient() as never
  },
  signer: async () => {
    if (getActiveNetworkKey() !== 'mainnet') throw new AppError('Switch to Arc Mainnet to use AgentBoard V2.')
    const provider = getActiveProvider() as { request: (a: unknown) => Promise<unknown> } | null
    if (!provider) throw new AppError('No wallet detected. Connect a browser wallet first.')
    const chain = await ensureArcChain()
    if (!chain.ok) throw new AppError('Switch your wallet to Arc Mainnet to continue.')
    const wc = createWalletClient({ chain: getActiveNetwork().chain as never, transport: custom(provider as never) })
    const [account] = await wc.getAddresses()
    if (!account) throw new AppError('Connect a wallet account first.')
    return { wc: wc as unknown as WalletLike, account }
  },
  signMessage: async message => {
    const provider = getActiveProvider() as { request: (a: unknown) => Promise<unknown> } | null
    if (!provider) throw new AppError('No wallet detected. Connect a browser wallet first.')
    const wc = createWalletClient({ chain: getActiveNetwork().chain as never, transport: custom(provider as never) })
    const [account] = await wc.getAddresses()
    if (!account) throw new AppError('Connect a wallet account first.')
    return wc.signMessage({ account, message })
  },
}
configureV2(env)

export * from './v2core'
