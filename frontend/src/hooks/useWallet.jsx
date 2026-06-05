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
    // Chain not added yet — add it silently
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

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!window.ethereum) return
    // Restore session
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts?.[0]) setAccount(accounts[0]) })
      .catch(() => {})
    // Listen for changes
    const onAccounts = (accounts) => setAccount(accounts?.[0] || null)
    const onChain = () => window.location.reload()
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged', onChain)
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use AgentBoard.')
      return
    }
    setConnecting(true)
    try {
      // Step 1 — request accounts (triggers MetaMask popup)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts?.[0]) {
        setAccount(accounts[0])
        // Step 2 — switch/add Arc chain silently in background, no error shown to user
        await ensureArcChain()
      }
    } catch (e) {
      // User rejected — do nothing, no error message shown
      if (e.code !== 4001) console.error('Wallet connect error:', e)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => setAccount(null), [])

  return (
    <WalletContext.Provider value={{ account, connecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
