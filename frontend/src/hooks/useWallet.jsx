import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

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
const ACTIVE_MODE_KEY = 'agentboard.activeWalletMode' // 'browser' | 'agent'

function loadAgentWallet() {
  try {
    const raw = localStorage.getItem(AGENT_WALLET_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadActiveMode() {
  try {
    return localStorage.getItem(ACTIVE_MODE_KEY) || null
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

  // Which signer is "active" right now — this is what every page should
  // read from instead of `account` directly, so Browser Wallet and Agent
  // Wallet behave as two interchangeable options behind one Connect button.
  const [activeMode, setActiveModeState] = useState(loadActiveMode)
  const [pickerOpen, setPickerOpen] = useState(false)

  const saveAgentWallet = useCallback((wallet) => {
    setAgentWallet(wallet)
    try {
      if (wallet) localStorage.setItem(AGENT_WALLET_KEY, JSON.stringify(wallet))
      else localStorage.removeItem(AGENT_WALLET_KEY)
    } catch {}
  }, [])

  const clearAgentWallet = useCallback(() => {
    saveAgentWallet(null)
    setActiveModeState(prev => {
      if (prev !== 'agent') return prev
      try { localStorage.removeItem(ACTIVE_MODE_KEY) } catch {}
      return null
    })
  }, [saveAgentWallet])

  const setActiveMode = useCallback((mode) => {
    setActiveModeState(mode)
    try {
      if (mode) localStorage.setItem(ACTIVE_MODE_KEY, mode)
      else localStorage.removeItem(ACTIVE_MODE_KEY)
    } catch {}
  }, [])

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

  const connectBrowser = useCallback(async () => {
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
        setActiveMode('browser')
      }
    } catch (e) {
      if (e.code !== 4001) {
        console.error('Wallet connect error:', e)
        setError('Connection failed. Please try again.')
      }
    } finally {
      setConnecting(false)
    }
  }, [setActiveMode])

  // Backwards-compatible alias — existing call sites using `connect()`
  // continue to connect the browser wallet directly.
  const connect = connectBrowser

  const useAgentWallet = useCallback(() => {
    if (!agentWallet) return false
    setActiveMode('agent')
    return true
  }, [agentWallet, setActiveMode])

  const disconnect = useCallback(() => {
    setAccount(null)
    setError(null)
    setActiveMode(null)
  }, [setActiveMode])

  const openPicker = useCallback(() => setPickerOpen(true), [])
  const closePicker = useCallback(() => setPickerOpen(false), [])

  // Unified signer surface: whichever wallet is "active" right now,
  // regardless of whether it's the browser extension or the Circle
  // agent wallet. Pages should prefer these over raw `account`.
  const activeAddress = useMemo(() => {
    if (activeMode === 'agent') return agentWallet?.address || null
    if (activeMode === 'browser') return account || null
    return null
  }, [activeMode, agentWallet, account])

  const isConnected = !!activeAddress

  return (
    <WalletContext.Provider value={{
      // Raw browser wallet state (kept for backward compatibility)
      account, connecting, connect, connectBrowser, disconnect, error,
      // Agent wallet state
      agentWallet, saveAgentWallet, clearAgentWallet, useAgentWallet,
      // Unified "active signer" surface
      activeMode, setActiveMode, activeAddress, isConnected,
      // Wallet picker UI state (Browser vs Agent chooser)
      pickerOpen, openPicker, closePicker,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
