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

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts?.[0]) setAccount(accounts[0]) })
      .catch(() => {})
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
    <WalletContext.Provider value={{ account, connecting, connect, disconnect, error }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
