import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import {
  initProviderDiscovery, getAnnouncedProviders, getActiveProvider,
  pickProvider, saveActiveProviderUuid, loadActiveProviderUuid, clearActiveProvider,
} from '../lib/providerRegistry'

const WalletContext = createContext(null)

const ARC_CHAIN_ID = '0x4cef52' // 5042002 — was '0x4CE352' (decodes to 5038930, a different/nonexistent chain). That mismatch was the actual root cause of both bugs: the app compared eth_chainId against the wrong number, so it never recognized an already-correct Arc Testnet connection, and wallet_switchEthereumChain always failed, forcing a fallback to wallet_addEthereumChain that created a duplicate/bogus network entry.
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
  const provider = getActiveProvider()
  if (!provider) return { ok: false, reason: 'no-wallet' }

  try {
    const currentChainId = await provider.request({ method: 'eth_chainId' })
    if (typeof currentChainId === 'string' && currentChainId.toLowerCase() === ARC_CHAIN_ID.toLowerCase()) {
      return { ok: true } // already on Arc — do nothing, no prompts at all
    }
  } catch {
    // eth_chainId should never really fail; fall through to attempting a switch
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_ID }],
    })
    return { ok: true }
  } catch (e) {
    const isUnrecognizedChain =
      e?.code === 4902 ||
      /unrecognized chain|add.*chain|not.*added/i.test(e?.message || '')

    if (!isUnrecognizedChain) {
      // Any other error (user rejected the switch, wallet's internal
      // hiccup, etc.) — don't guess and don't spam wallet_addEthereumChain.
      return { ok: false, reason: 'switch-failed', error: e }
    }

    // Before adding, double-check the wallet doesn't already have Arc
    // configured under a chain table that just failed to switch cleanly.
    // Some wallets (Bitget in particular) return a switch error that
    // looks like "unrecognized chain" even when the chain is already
    // present, if their internal chain list is momentarily out of sync
    // with eth_chainId. Re-reading chainId here — instead of trusting the
    // error message — is what avoids the duplicate add.
    try {
      const recheck = await provider.request({ method: 'eth_chainId' })
      if (typeof recheck === 'string' && recheck.toLowerCase() === ARC_CHAIN_ID.toLowerCase()) {
        return { ok: true }
      }
    } catch {}

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [ARC_CHAIN],
      })
      return { ok: true }
    } catch (addErr) {
      // "already exists"-style rejections mean the add was redundant —
      // treat as success rather than surfacing an error for a chain
      // that's actually fine.
      const alreadyExists = /already exist|already added/i.test(addErr?.message || '')
      if (alreadyExists) return { ok: true }
      return { ok: false, reason: 'add-failed', error: addErr }
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

  const [providerUuid, setProviderUuid] = useState(loadActiveProviderUuid)
  const [availableProviders, setAvailableProviders] = useState([])

  useEffect(() => {
    initProviderDiscovery()
    const t = setTimeout(() => setAvailableProviders(getAnnouncedProviders()), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const provider = getActiveProvider()
    if (!provider) return

    provider.request({ method: 'eth_accounts' })
      .then(accounts => { if (accounts?.[0]) setAccount(accounts[0]) })
      .catch(() => {})

    provider.request({ method: 'eth_chainId' })
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

    provider.on?.('accountsChanged', onAccounts)
    provider.on?.('chainChanged', onChain)
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts)
      provider.removeListener?.('chainChanged', onChain)
    }
  }, [providerUuid, availableProviders])

  // Lets the picker offer a specific injected wallet by name (MetaMask vs
  // Bitget vs Rabby) instead of guessing from window.ethereum. Falls back
  // to plain auto-resolved connect when only one wallet is present.
  const connectBrowser = useCallback(async (uuid) => {
    const provider = uuid ? pickProvider(uuid) : getActiveProvider()
    if (!provider) {
      setError('No wallet detected. Install MetaMask or Rabby to connect.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      if (accounts?.[0]) {
        // Pin this exact provider object as "the" wallet for the rest of
        // the session — every later switchChain/addChain/writeContract
        // call goes back through getActiveProvider(), which now resolves
        // to this same instance instead of re-guessing window.ethereum.
        if (uuid) {
          saveActiveProviderUuid(uuid)
          setProviderUuid(uuid)
        }
        setAccount(accounts[0])
        // Just read the current chain here — don't prompt switch/add-chain
        // as part of connecting. Whatever RPC/network the wallet is already
        // on, connect should succeed immediately. The actual chain
        // assertion (and any switch/add prompt) happens lazily, right
        // before a write via getWalletClient(), which is the only moment
        // it's actually needed.
        try {
          const currentChainId = await provider.request({ method: 'eth_chainId' })
          setWrongChain(typeof currentChainId === 'string' && currentChainId.toLowerCase() !== ARC_CHAIN_ID.toLowerCase())
        } catch {
          setWrongChain(false)
        }
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
    // Clear the pinned provider too — next connect should be free to pick
    // (or re-pick) whichever injected wallet the user chooses.
    clearActiveProvider()
    setProviderUuid(null)
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
      // Multi-wallet (EIP-6963) discovery — lets the picker show MetaMask,
      // Bitget, Rabby etc. as distinct named options instead of a single
      // ambiguous "Browser Wallet" button when more than one is installed.
      availableProviders, providerUuid,
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
