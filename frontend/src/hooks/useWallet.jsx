import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WalletContext = createContext(null)

// Chain config
const ARC_CHAIN_ID = '0x4CE352' // 5042002
const ARC_CHAIN = {
  chainId: ARC_CHAIN_ID,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  // Restore session on mount
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
    setError(null)

    // No wallet at all
    if (!window.ethereum) {
      setError('No wallet detected. Please open this app inside MetaMask browser.')
      return
    }

    setConnecting(true)
    try {
      // Step 1: Request accounts first (this triggers the MetaMask popup)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (!accounts?.[0]) throw new Error('No account returned')
      setAccount(accounts[0])

      // Step 2: Try switching to Arc — non-blocking, don't fail connection if this fails
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_CHAIN_ID }],
        })
      } catch (switchErr) {
        // Chain not added yet — add it
        if (switchErr.code === 4902 || switchErr.code === -32603 || switchErr.message?.includes('Unrecognized')) {
          try {
            await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ARC_CHAIN] })
          } catch {
            // Adding chain failed — wallet still connected, just on wrong chain
            setError('Connected! Please manually add Arc Testnet (Chain ID: 5042002) in your wallet.')
          }
        }
        // Any other switch error — wallet still connected
      }
    } catch (e) {
      if (e.code === 4001 || e.message?.includes('rejected') || e.message?.includes('denied')) {
        setError('Connection rejected — please approve in your wallet.')
      } else if (e.message?.includes('No account')) {
        setError('No accounts found. Unlock your wallet and try again.')
      } else {
        setError(`Connection failed: ${e.message}`)
      }
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => { setAccount(null); setError(null) }, [])

  return (
    <WalletContext.Provider value={{ account, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
