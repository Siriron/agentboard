// EIP-6963 provider registry.
//
// With more than one extension installed (MetaMask + Bitget being the
// common case), `window.ethereum` is not "the wallet the user picked" —
// it's whichever extension won the injection race, and some wallets
// overwrite it after the fact. Calling wallet_switchEthereumChain /
// wallet_addEthereumChain against the wrong provider is exactly what
// causes both symptoms reported:
//   1. MetaMask "works only after manually selecting the Arc RPC" —
//      the switch/add request was sometimes landing on a different
//      injected provider than the one actually connected.
//   2. Bitget "adds a duplicate mainnet RPC even though Arc already
//      exists" — Bitget's own window.ethereum shim keeps a separate
//      internal chain table from the one wallet_addEthereumChain reads
//      eth_chainId from, so a race meant we occasionally called
//      wallet_addEthereumChain when we shouldn't have.
//
// EIP-6963 (wallet_announceProvider / eip6963:requestProvider) gives each
// installed wallet a distinct, stable provider object with its own uuid,
// name, and icon — so we can target the exact one the user connected
// with, every time, regardless of what window.ethereum currently points to.

const providers = new Map() // uuid -> { info, provider }

function onAnnounce(event) {
  const { info, provider } = event.detail || {}
  if (!info?.uuid || !provider) return
  providers.set(info.uuid, { info, provider })
}

let listening = false
export function initProviderDiscovery() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('eip6963:announceProvider', onAnnounce)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

export function getAnnouncedProviders() {
  return Array.from(providers.values())
}

const ACTIVE_PROVIDER_KEY = 'agentboard.activeProviderUuid'

export function saveActiveProviderUuid(uuid) {
  try {
    if (uuid) localStorage.setItem(ACTIVE_PROVIDER_KEY, uuid)
    else localStorage.removeItem(ACTIVE_PROVIDER_KEY)
  } catch {}
}

export function loadActiveProviderUuid() {
  try {
    return localStorage.getItem(ACTIVE_PROVIDER_KEY) || null
  } catch {
    return null
  }
}

// Resolves the provider to actually talk to, in priority order:
//   1. The wallet the user explicitly connected with last time (by uuid),
//      if it's still announced — this is what fixes both bugs, since we
//      keep using the SAME provider object no matter what window.ethereum
//      re-points to afterwards.
//   2. If there's exactly one EIP-6963 announcement, use it — unambiguous.
//   3. Fall back to window.ethereum (older wallets that don't support
//      EIP-6963 yet, or a single-wallet browser).
//   4. window.ethereum.providers[] (the older, less reliable multi-wallet
//      convention some wallets used before EIP-6963 existed).
export function getActiveProvider() {
  const uuid = loadActiveProviderUuid()
  if (uuid && providers.has(uuid)) return providers.get(uuid).provider

  const all = getAnnouncedProviders()
  if (all.length === 1) return all[0].provider

  if (typeof window !== 'undefined' && window.ethereum) {
    if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
      // No saved preference and multiple legacy-style providers — best we
      // can do is the first one; the picker below is what actually lets
      // the user disambiguate going forward.
      return window.ethereum.providers[0]
    }
    return window.ethereum
  }

  return all[0]?.provider || null
}

export function pickProvider(uuid) {
  saveActiveProviderUuid(uuid)
  return providers.get(uuid)?.provider || null
}

export function clearActiveProvider() {
  saveActiveProviderUuid(null)
}
