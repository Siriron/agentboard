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
  // The two header buttons are the only network control. Each opens that network's own homepage (/testnet or /mainnet),
  // never an arbitrary inner page. Mainnet asks for the one-time real-USDC confirmation first.
  const choose = async k => { const ok = await selectNetwork(k, key, setNetwork, confirmMainnet); if (ok && pathname !== `/${k}`) navigate(`/${k}`) }
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
