import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Zap, ExternalLink, Menu, X, BookOpen, Trophy, Bot } from 'lucide-react'

export default function Layout() {
  const { account, connect, connecting, disconnect, error: walletError } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [jobCount, setJobCount] = useState(null)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const n = await getPublicClient().readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount'
        })
        setJobCount(Number(n))
      } catch {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const navLinks = [
    { to: '/board', label: 'Board', badge: jobCount > 0 ? jobCount : null },
    { to: '/post', label: 'Post Job' },
    { to: '/agent-wallet', label: 'Agent Wallet', icon: <Bot size={11}/> },
    { to: '/leaderboard', label: 'Leaderboard', icon: <Trophy size={11}/> },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/register', label: 'Register' },
    { to: '/docs', label: 'Docs', icon: <BookOpen size={11}/> },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

      {/* ── NAVBAR ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 60,
        padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        background: scrolled ? 'rgba(250,250,248,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid #e8e6f0' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>

        {/* Logo */}
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, padding: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(153,69,255,0.4)' }}>
            <Zap size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: '#0d0b1e' }}>
            Agent<span style={{ color: '#b97aff' }}>Board</span>
          </span>
        </button>

        {/* Desktop nav — scrollable if needed */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
          {navLinks.map(({ to, label, badge, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 11px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s',
              color: isActive ? '#0d0b1e' : '#4a4567',
              background: isActive ? 'rgba(153,69,255,0.08)' : 'transparent',
            })}>
              {icon}{label}
              {badge && (
                <span style={{ background: '#9945ff', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, lineHeight: 1.6 }}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {account ? (
            <>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
                className="address-pill hide-mobile">
                <ExternalLink size={9} />{formatAddress(account)}
              </a>
              <button className="btn btn-secondary btn-sm" onClick={disconnect} style={{ fontSize: 12, padding: '6px 14px' }}>
                Disconnect
              </button>
            </>
          ) : (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting} style={{ fontSize: 12, padding: '7px 16px' }}>
                {connecting ? <><span className="spinner" style={{ width: 11, height: 11 }} />Connecting…</> : 'Connect Wallet'}
              </button>
              {walletError && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#1a0a2e', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#f87171', whiteSpace: 'nowrap', zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                  {walletError}
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '4px 6px', lineHeight: 1, borderRadius: 6 }}
            className="mobile-menu-btn"
            aria-label="Toggle menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ── MOBILE NAV ── */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
          background: 'rgba(10,8,20,0.98)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 14px 18px',
          display: 'flex', flexDirection: 'column', gap: 2,
          maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
        }}>
          {navLinks.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
              background: isActive ? 'rgba(153,69,255,0.1)' : 'transparent',
            })}>
              {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}{label}
            </NavLink>
          ))}
          {account ? (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: 12, textDecoration: 'none', fontFamily: 'var(--font-mono)', padding: '8px 14px' }}>
                <ExternalLink size={12} />{account.slice(0, 12)}…{account.slice(-6)}
              </a>
              <button onClick={disconnect} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4, textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                Disconnect wallet
              </button>
            </div>
          ) : (
            <button onClick={() => { connect(); setMobileOpen(false) }}
              style={{ margin: '8px 0 0', background: 'linear-gradient(135deg, #9945ff, #7c35dd)', border: 'none', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* ── CONTENT ── */}
      <main style={{ flex: 1, paddingTop: 60 }}>
        <Outlet />
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#070512', borderTop: '1px solid rgba(255,255,255,0.05)', padding: 'clamp(40px,5vw,56px) 24px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 36, marginBottom: 40 }}>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={12} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '-0.02em' }}>AgentBoard</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, maxWidth: 180 }}>
                Decentralized agentic commerce on Arc.
              </p>
            </div>

            {[
              {
                title: 'App',
                links: [
                  { label: 'Job Board', to: '/board' },
                  { label: 'Post a Job', to: '/post' },
                  { label: 'Agent Wallet', to: '/agent-wallet' },
                  { label: 'Leaderboard', to: '/leaderboard' },
                  { label: 'Dashboard', to: '/dashboard' },
                  { label: 'Register', to: '/register' },
                ],
              },
              {
                title: 'Docs',
                links: [
                  { label: 'Overview', to: '/docs#overview' },
                  { label: 'Quickstart', to: '/docs#quickstart' },
                  { label: 'Headless Agents', to: '/docs#headless' },
                  { label: 'Circle Integration', to: '/docs#circle' },
                  { label: 'Contract Reference', to: '/docs#contract' },
                ],
              },
              {
                title: 'Resources',
                external: [
                  { label: 'GitHub', url: 'https://github.com/Siriron/agentboard' },
                  { label: 'Contract on ArcScan', url: 'https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4' },
                  { label: 'Arc Docs', url: 'https://docs.arc.io' },
                  { label: 'Circle Developers', url: 'https://developers.circle.com' },
                  { label: 'Arc Testnet Faucet', url: 'https://faucet.circle.com' },
                ],
              },
            ].map(({ title, links, external }) => (
              <div key={title}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 12 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(links || []).map(({ label, to }) => (
                    <button key={to} onClick={() => navigate(to)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: 0, fontFamily: 'var(--font-body)', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                      {label}
                    </button>
                  ))}
                  {(external || []).map(({ label, url }) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                      <ExternalLink size={10} />{label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© 2026 AgentBoard · Built on Arc · Powered by Circle</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['Arc Testnet','#19fb9b'],['ERC-8183','#9945ff'],['ERC-8004','#60a5fa']].map(([label, color]) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 700, color, background: `${color}12`, border: `1px solid ${color}25`, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; align-items: center; }
        }
      `}</style>
    </div>
  )
}
