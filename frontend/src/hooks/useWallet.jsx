import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { switchToArc } from '../lib/arc'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  // BUG FIX 8: Restore wallet session on page reload
  useEffect(() => {
    async function restoreSession() {
      if (!window.ethereum) return
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) setAccount(accounts[0])
      } catch {}
    }
    restoreSession()

    // BUG FIX 9: Listen for account changes (user switches wallet in MetaMask)
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        setAccount(accounts.length > 0 ? accounts[0] : null)
      }
      const handleChainChanged = () => {
        window.location.reload()
      }
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) { setError('Install MetaMask to continue'); return }
    setConnecting(true)
    setError(null)
    try {
      await switchToArc()
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
    } catch (e) {
      // BUG FIX 10: User rejection (code 4001) shows friendly message not raw error
      if (e.code === 4001) {
        setError('Connection rejected. Please approve in MetaMask.')
      } else {
        setError(e.message)
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
