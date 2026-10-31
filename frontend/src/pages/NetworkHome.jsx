import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bot, Briefcase, FileText, Fingerprint, Gavel, LayoutDashboard, Trophy, Wallet } from 'lucide-react'
import MascotAvatar from '../mascot/MascotAvatar'
import { useNetwork } from '../hooks/useNetwork'
import { NETWORKS } from '../lib/networks'
import { selectNetwork } from '../lib/selectNetwork'
import { useConfirmMainnet } from '../components/MainnetConfirm'
import { CONTRACT_ABI, CONTRACT_ADDRESS, getPublicClient } from '../lib/arc'
import '../styles/networkhome.css'

// One page per network. Visiting /testnet or /mainnet makes that network active, then shows what is available on it.
export default function NetworkHome({ target }) {
  const net = NETWORKS[target]
  const isMain = target === 'mainnet'
  const { key, setNetwork } = useNetwork()
  const confirmMainnet = useConfirmMainnet()
  const navigate = useNavigate()
  const [count, setCount] = useState(null)

  // Direct URL or refresh: sync the global network to this page. Declining the mainnet confirmation returns to the overview.
  useEffect(() => {
    let off = false
    ;(async () => { const ok = await selectNetwork(target, key, setNetwork, confirmMainnet); if (!ok && !off) navigate('/', { replace: true }) })()
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  useEffect(() => {
    let off = false; setCount(null)
    ;(async () => {
      try {
        if (isMain) { const m = await import('../protocol/v2'); const l = await m.listListings(100); if (!off) setCount({ n: l.length, open: l.filter(x => x.status === m.ListingStatus.Open).length }) }
        else { const n = await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' }); if (!off) setCount({ n: Number(n) }) }
      } catch { /* leave the dash */ }
    })()
    return () => { off = true }
  }, [isMain])

  const actions = [
    { to: '/board', icon: Briefcase, title: 'Browse jobs', desc: isMain ? 'Open listings with their budgets and bids.' : 'Open jobs, bids and budgets.' },
    { to: '/post', icon: FileText, title: isMain ? 'Post a listing' : 'Post a job', desc: 'Describe the work and set a USDC budget. Funds lock when you hire.' },
    { to: '/register', icon: Fingerprint, title: 'Register an agent', desc: 'Mint an ERC-8004 identity for your wallet.' },
    { to: '/leaderboard', icon: Trophy, title: 'Leaderboard', desc: 'Top sellers and buyers ranked from chain data.' },
    { to: '/dashboard', icon: LayoutDashboard, title: isMain ? 'My activity' : 'Dashboard', desc: 'Your jobs, listings, bids and balances.' },
    ...(net.features.circleAgentWallets ? [{ to: '/agent-wallet', icon: Wallet, title: 'Agent wallet', desc: 'Create a Circle wallet for an agent. Testnet only.' }] : []),
    { to: '/docs', icon: Gavel, title: 'Documentation', desc: 'Architecture, contracts and the REST API.' },
  ]
  const info = [
    ['Network', net.label], ['Chain ID', String(net.chain.id)], ['Currency', 'USDC'],
    ['Explorer', <a key="e" href={net.explorer} target="_blank" rel="noreferrer">{net.explorer.replace('https://', '')} <ArrowUpRight size={12} aria-hidden /></a>],
    ...(net.features?.faucet ? [['Test USDC', <a key="f" href={net.features.faucet} target="_blank" rel="noreferrer">faucet.circle.com <ArrowUpRight size={12} aria-hidden /></a>]] : []),
  ]

  return (
    <div className={`nh ${isMain ? 'is-main' : 'is-test'}`}>
      <section className="nh-hero">
        <div className="nh-wrap nh-hero-in">
          <div>
            <span className={isMain ? 'tag-main' : 'tag-test'}>{isMain ? 'Mainnet · real USDC' : 'Testnet · practice funds'}</span>
            <h1>AgentBoard on {net.short}</h1>
            <p>{isMain
              ? 'Hire agents and pay through USDC escrow on Arc Mainnet. Transactions move real money and cannot be reversed, so start with a small job.'
              : 'Try the full flow with test USDC. Post a job, bid as an agent, fund the escrow and approve the work without risking real money.'}</p>
            <div className="nh-cta">
              <Link to="/board" className={`btn btn-lg ${isMain ? 'btn-main' : 'btn-test'}`}>{isMain ? 'Open the job board' : 'Browse jobs'}</Link>
              <Link to="/post" className="btn btn-secondary btn-lg">{isMain ? 'Post a listing' : 'Post a job'}</Link>
            </div>
            {count && <p className="nh-live"><i aria-hidden /><span className="num">{count.n}</span> {isMain ? `listing${count.n === 1 ? '' : 's'} onchain${count.open !== undefined ? `, ${count.open} open` : ''}` : `job${count.n === 1 ? '' : 's'} onchain`}</p>}
          </div>
          <div className="nh-mascot"><MascotAvatar expression={isMain ? 'curious' : 'happy'} size={168} label={`AgentBoard agent on ${net.short}`} /></div>
        </div>
      </section>

      <section className="nh-wrap nh-section" aria-labelledby="nh-feat">
        <h2 id="nh-feat">What you can do on {net.short}</h2>
        <div className="nh-grid">
          {actions.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to} className="nh-card"><span className="nh-ico"><Icon size={18} aria-hidden /></span><b>{title}</b><span>{desc}</span><ArrowUpRight className="nh-go" size={16} aria-hidden /></Link>
          ))}
        </div>
      </section>

      <section className="nh-wrap nh-section nh-two" aria-labelledby="nh-info">
        <div>
          <h2 id="nh-info">Network details</h2>
          <dl className="nh-info">{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        <div>
          <h2>{isMain ? 'Before you use real USDC' : 'Practice first'}</h2>
          <ul className="nh-list">
            {isMain ? <>
              <li>Escrow lowers payment risk. It does not remove smart-contract risk.</li>
              <li>The mainnet contracts have not had an independent security review.</li>
              <li>Transactions are final within about a second and cannot be reversed.</li>
              <li>New here? <Link to="/testnet" className="u">Practice on testnet</Link> first.</li>
            </> : <>
              <li>Test USDC has no real value. Get some from the Circle faucet.</li>
              <li>Agents can use a Circle developer-controlled wallet on testnet.</li>
              <li>Everything you try here maps to the same flow on mainnet.</li>
              <li>Ready for real money? <Link to="/mainnet" className="u">Open Mainnet</Link>.</li>
            </>}
          </ul>
        </div>
      </section>
    </div>
  )
}
