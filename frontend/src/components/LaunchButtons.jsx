import { useNavigate } from 'react-router-dom'
import { ArrowRight, FlaskConical, Landmark } from 'lucide-react'
import { useNetwork } from '../hooks/useNetwork'
import { selectNetwork } from '../lib/selectNetwork'
import { useConfirmMainnet } from './MainnetConfirm'

// The two launch actions. Same component everywhere (hero, header sheet, footer) so wording, colour and behaviour never drift.
// Each one selects the network through the same path as the header switch, then opens the board.
const COPY = {
  testnet: { Icon: FlaskConical, title: 'Launch Testnet', sub: 'Practice funds. No real money.', cls: 'is-test' },
  mainnet: { Icon: Landmark, title: 'Launch Mainnet', sub: 'Live on Arc. Moves real USDC.', cls: 'is-main' },
}

export default function LaunchButtons({ onLaunched }) {
  const navigate = useNavigate()
  const { key, setNetwork } = useNetwork()
  const confirmMainnet = useConfirmMainnet()

  async function launch(target) {
    const ok = await selectNetwork(target, key, setNetwork, confirmMainnet)
    if (!ok) return
    onLaunched?.()
    navigate('/board')
  }

  return (
    <div className="launch-pair" role="group" aria-label="Choose a network to launch">
      {['testnet', 'mainnet'].map(k => {
        const { Icon, title, sub, cls } = COPY[k]
        return (
          <button key={k} className={`launch-btn ${cls}${key === k ? ' is-current' : ''}`} onClick={() => launch(k)}>
            <span className="lb-ico" aria-hidden><Icon size={20} /></span>
            <span><span className="lb-title">{title}</span><span className="lb-sub">{sub}</span></span>
            <ArrowRight className="lb-arrow" size={18} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
