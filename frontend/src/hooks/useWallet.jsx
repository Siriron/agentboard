import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WalletContext = createContext(null)

const ARC_CHAIN_ID = '0x4CE352' // 5042002
const ARC_CHAIN = {
  chainId: ARC_CHAIN_ID,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
}

async function ensureArcChain() {
  if (!window.ethereum) return
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_ID }],
    })
  } catch (e) {
    if (e.code === 4902 || e.code === -32603) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARC_CHAIN],
        })
      } catch {}
    }
  }
}

const AGENT_WALLET_KEY = 'agentboard.agentWallet'

function loadAgentWallet() {
  try {
    const raw = localStorage.getItem(AGENT_WALLET_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  // Circle-managed agent wallet (MPC), separate from the MetaMask/Rabby
  // browser wallet above. Persisted so it survives navigation/reloads.
  const [agentWallet, setAgentWallet] = useState(loadAgentWallet)

  const saveAgentWallet = useCallback((wallet) => {
    setAgentWallet(wallet)
    try {
      if (wallet) localStorage.setItem(AGENT_WALLET_KEY, JSON.stringify(wallet))
      else localStorage.removeItem(AGENT_WALLET_KEY)
    } catch {}
  }, [])

  const clearAgentWallet = useCallback(() => saveAgentWallet(null), [saveAgentWallet])

  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts?.[0]) setAccount(accounts[0]) })
      .catch(() => {})
    const onAccounts = (accounts) => setAccount(accounts?.[0] || null)
    const onChain = () => { setAccount(null); window.location.reload() }
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged', onChain)
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Install MetaMask or Rabby to connect.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts?.[0]) {
        setAccount(accounts[0])
        await ensureArcChain()
      }
    } catch (e) {
      if (e.code !== 4001) {
        console.error('Wallet connect error:', e)
        setError('Connection failed. Please try again.')
      }
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setError(null)
  }, [])

  return (
    <WalletContext.Provider value={{
      account, connecting, connect, disconnect, error,
      agentWallet, saveAgentWallet, clearAgentWallet,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
