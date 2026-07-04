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

// Checks the wallet's current chain and only switches/adds Arc Testnet
// when actually necessary. Many wallets (Bitget in particular) throw a
// generic -32603 for unrelated hiccups on wallet_switchEthereumChain —
// treating that as "chain missing" caused a duplicate add-chain prompt
// even when Arc was already configured. Only 4902 (and the couple of
// wallets that report it via message instead of code) means "not added."
export async function ensureArcChain() {
  if (!window.ethereum) return { ok: false, reason: 'no-wallet' }

  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
    if (typeof currentChainId === 'string' && currentChainId.toLowerCase() === ARC_CHAIN_ID.toLowerCase()) {
      return { ok: true } // already on Arc — do nothing, no prompts at all
    }
  } catch {
    // eth_chainId should never really fail; fall through to attempting a switch
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_ID }],
    })
    return { ok: true }
  } catch (e) {
    const isUnrecognizedChain =
      e?.code === 4902 ||
      /unrecognized chain|add.*chain|not.*added/i.test(e?.message || '')

    if (isUnrecognizedChain) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARC_CHAIN],
        })
        return { ok: true }
      } catch (addErr) {
        return { ok: false, reason: 'add-failed', error: addErr }
      }
    }

    // Any other error (user rejected the switch, wallet's internal hiccup,
    // etc.) — don't guess and don't spam wallet_addEthereumChain.
    return { ok: false, reason: 'switch-failed', error: e }
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
  const [wrongChain, setWrongChain] = useState(false)

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

    window.ethereum.request({ method: 'eth_chainId' })
      .then(id => setWrongChain(typeof id === 'string' && id.toLowerCase() !== ARC_CHAIN_ID.toLowerCase()))
      .catch(() => {})

    const onAccounts = (accounts) => setAccount(accounts?.[0] || null)

    // Switching networks (for any reason — another dapp, manual switch,
    // the wallet's own UI) used to wipe the whole session and force a
    // full page reload. Now it just updates whether we're on the right
    // chain; the account and active signer stay intact, and every write
    // path re-asserts Arc right before it actually needs to sign.
    const onChain = (chainId) => {
      setWrongChain(typeof chainId === 'string' && chainId.toLowerCase() !== ARC_CHAIN_ID.toLowerCase())
    }

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
        const result = await ensureArcChain()
        setWrongChain(!result.ok)
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

  // Lets any page prompt a chain switch without forcing a disconnect —
  // e.g. "Switch to Arc" button shown when wrongChain is true.
  const switchChain = useCallback(async () => {
    const result = await ensureArcChain()
    setWrongChain(!result.ok)
    return result.ok
  }, [])

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
      // Chain state — lets the UI prompt a switch without a disconnect/reconnect cycle
      wrongChain, switchChain,
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
