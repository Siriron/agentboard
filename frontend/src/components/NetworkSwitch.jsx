import { useNetwork } from '../hooks/useNetwork'
import { NETWORK_KEYS, NETWORKS } from '../lib/networks'

// Testnet / Mainnet segmented switch. Switching to mainnet asks for a one-time
// confirmation per session because mainnet handles real USDC.
export default function NetworkSwitch({ compact = false }) {
  const { key, setNetwork } = useNetwork()

  function choose(next) {
    if (next === key) return
    if (next === 'mainnet') {
      let ok = true
      try { ok = sessionStorage.getItem('agentboard.mainnetAck') === '1' } catch { ok = false }
      if (!ok) {
        const confirmed = window.confirm(
          'Arc Mainnet uses real USDC. Transactions cost real money and cannot be undone. Continue?'
        )
        if (!confirmed) return
        try { sessionStorage.setItem('agentboard.mainnetAck', '1') } catch { /* ignore */ }
      }
    }
    setNetwork(next)
  }

  return (
    <div role="group" aria-label="Network" className="net-switch" style={{
      display: 'inline-flex', padding: 2, borderRadius: 99,
      background: 'var(--bg-subtle)', border: '1.5px solid var(--border)', flexShrink: 0,
    }}>
      {NETWORK_KEYS.map(k => {
        const selected = k === key
        const net = NETWORKS[k]
        return (
          <button key={k} onClick={() => choose(k)} aria-pressed={selected}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 99,
              padding: compact ? '5px 10px' : '5px 12px',
              fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 5,
              color: selected ? '#fff' : 'var(--text-2)',
              background: selected ? (net.realFunds ? '#0f766e' : 'var(--accent)') : 'transparent',
              transition: 'all 0.15s',
            }}>
            <span aria-hidden className="net-dot" style={{
              width: 6, height: 6, borderRadius: 99,
              background: selected ? '#fff' : (net.realFunds ? '#0f766e' : 'var(--text-3)'),
            }} />
            {net.short}
          </button>
        )
      })}
    </div>
  )
}
