import { Suspense } from 'react'
import { useNetwork } from '../hooks/useNetwork'
import { protocolFor } from '../lib/networks'
import MainnetGate from './MainnetGate'
import NotFound from '../pages/NotFound'

// Picks the page implementation for the active network:
//   testnet            -> v1 element (unchanged V1 pages)
//   mainnet, V2 on     -> v2 element (src/v2), or the gate when a feature has no V2 page yet
//   mainnet, V2 off    -> "launch in progress" gate
// V1 pages are never rendered on mainnet, so V1 code cannot touch real funds.
export default function ProtocolSwitch({ v1, v2, feature }) {
  const { key } = useNetwork()
  if (key === 'testnet') return v1 ?? <NotFound />
  const p = protocolFor('mainnet')
  if (p === 'v2' && v2) {
    return <Suspense fallback={<div style={{ padding: 96, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>}>{v2}</Suspense>
  }
  return <MainnetGate feature={feature} testnetOnly={p === 'v2'}>{null}</MainnetGate>
}
