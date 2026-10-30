import { useNetwork } from '../hooks/useNetwork'
import { NETWORK_KEYS, NETWORKS } from '../lib/networks'
import { selectNetwork } from '../lib/selectNetwork'
import { useConfirmMainnet } from './MainnetConfirm'

// Testnet / Mainnet segmented switch. Mainnet asks for a one-time confirmation per session (real USDC).
export default function NetworkSwitch({ compact = false }) {
  const { key, setNetwork } = useNetwork()
  const confirmMainnet = useConfirmMainnet()
  return (
    <div role="group" aria-label="Network" className="net-switch">
      {NETWORK_KEYS.map(k => {
        const net = NETWORKS[k]
        return (
          <button key={k} onClick={() => selectNetwork(k, key, setNetwork, confirmMainnet)} aria-pressed={k === key}
            className={net.realFunds ? 'is-main' : 'is-test'}
            style={{ padding: compact ? '5px 9px' : '6px 12px', fontSize: 12.5, minHeight: 30 }}>
            <span aria-hidden className="net-dot" />{net.short}
          </button>
        )
      })}
    </div>
  )
}
