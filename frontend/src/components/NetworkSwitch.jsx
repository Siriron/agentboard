import { useLocation, useNavigate } from 'react-router-dom'
import { useNetwork } from '../hooks/useNetwork'
import { NETWORK_KEYS, NETWORKS } from '../lib/networks'
import { selectNetwork } from '../lib/selectNetwork'
import { useConfirmMainnet } from './MainnetConfirm'

// Testnet / Mainnet segmented switch. Mainnet asks for a one-time confirmation per session (real USDC).
export default function NetworkSwitch({ compact = false }) {
  const { key, setNetwork } = useNetwork()
  const confirmMainnet = useConfirmMainnet()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Switching network from an inner page lands on the homepage for that network, never on an arbitrary inner page.
  const choose = async k => { const ok = await selectNetwork(k, key, setNetwork, confirmMainnet); if (ok && k !== key && pathname !== '/') navigate('/') }
  return (
    <div role="group" aria-label="Network" className="net-switch">
      {NETWORK_KEYS.map(k => {
        const net = NETWORKS[k]
        return (
          <button key={k} onClick={() => choose(k)} aria-pressed={k === key}
            className={net.realFunds ? 'is-main' : 'is-test'}
            style={{ padding: compact ? '5px 9px' : '6px 12px', fontSize: 12.5, minHeight: 30 }}>
            <span aria-hidden className="net-dot" />{net.short}
          </button>
        )
      })}
    </div>
  )
}
