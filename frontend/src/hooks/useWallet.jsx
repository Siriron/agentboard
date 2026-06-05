import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!window.ethereum) return
    // Restore session
    window.ethereum.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts?.[0]) setAccount(accounts[0]) })
      .catch(() => {})
    // Listen for changes
    const onAccounts = (accounts) => setAccount(accounts?.[0] || null)
    window.ethereum.on('accountsChanged', onAccounts)
    return () => window.ethereum.removeListener('accountsChanged', onAccounts)
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Please install MetaMask.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      // Just request accounts — no chain switching, no errors about wrong chain
      // Arc RPC is already in their wallet, transactions will route correctly
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts?.[0]) setAccount(accounts[0])
    } catch (e) {
      if (e.code !== 4001) setError('Connection failed. Try again.')
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
  return useContext(WalletContext)
}
