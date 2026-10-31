import { useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useNetwork } from '../hooks/useNetwork'
import { selectNetwork } from '../lib/selectNetwork'
import { useConfirmMainnet } from './MainnetConfirm'

// Network selector used on the homepage (and anywhere a full-size choice is needed).
// Selecting a network changes the active network context and keeps the user on the homepage experience for that network.
// It never navigates into the app by itself.
const OPTIONS = [
  { key: 'testnet', title: 'Testnet', line: 'Practice with test USDC. No real value.', cls: 'is-test' },
  { key: 'mainnet', title: 'Mainnet', line: 'Live on Arc. Transactions use real USDC.', cls: 'is-main', tag: 'Real USDC' },
]

export default function NetworkSelect({ label = 'Network' }) {
  const { key, setNetwork } = useNetwork()
  const confirmMainnet = useConfirmMainnet()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function choose(next) {
    const ok = await selectNetwork(next, key, setNetwork, confirmMainnet)
    if (ok && pathname !== '/') navigate('/')
  }

  return (
    <div className="netsel" role="radiogroup" aria-label={label}>
      {OPTIONS.map(o => (
        <button key={o.key} role="radio" aria-checked={key === o.key} className={`netsel-opt ${o.cls}`} onClick={() => choose(o.key)}>
          <span className="ns-body">
            <span className="ns-title">{o.title}{o.tag && <span className="tag-main">{o.tag}</span>}</span>
            <span className="ns-line">{o.line}</span>
          </span>
          <span className="ns-check" aria-hidden><Check size={14} strokeWidth={3} /></span>
        </button>
      ))}
    </div>
  )
}
