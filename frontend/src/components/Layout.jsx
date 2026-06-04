import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Briefcase, Plus, LayoutDashboard, User, Zap, ExternalLink, Menu, X, AlertCircle } from 'lucide-react'

export default function Layout() {
  const { account, connect, connecting, disconnect, error } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const [jobCount, setJobCount] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showError, setShowError] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    if (error) { setShowError(true); const t = setTimeout(() => setShowError(false), 6000); return () => clearTimeout(t) }
  }, [error])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    async function fetch() {
      try {
        const n = await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
        setJobCount(Number(n))
      } catch {}
    }
    fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t)
  }, [])

  const navLinks = [
    { to: '/board', label: 'Board', icon: <Briefcase size={14} />, badge: jobCount },
    { to: '/post', label: 'Post Job', icon: <Plus size={14} /> },
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
    { to: '/register', label: 'Register', icon: <User size={14} /> },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(10,10,15,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        transition: 'all 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--indigo), var(--violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>
            Agent<span style={{ color: '#818cf8' }}>Board</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {navLinks.map(({ to, label, icon, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              color: isActive ? 'var(--text-1)' : 'var(--text-3)',
              background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
              transition: 'all 0.15s',
            })}>
              {icon}{label}
              {badge > 0 && <span style={{ background: 'var(--indigo)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, lineHeight: 1.5 }}>{badge}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Arc badge */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--emerald)', display: 'inline-block', boxShadow: '0 0 6px var(--emerald)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--emerald)', letterSpacing: '0.04em' }}>Arc Testnet</span>
          </div>

          {account ? (
            <>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer" className="address-pill hide-mobile">
                <ExternalLink size={10} />{formatAddress(account)}
              </a>
              <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? <><span className="spinner" style={{ width: 12, height: 12 }} />Connecting…</> : 'Connect Wallet'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" id="mob-btn" onClick={() => setMobileOpen(o => !o)} style={{ display: 'none' }}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Wallet error */}
      {showError && error && (
        <div style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} color="var(--amber)" />
          <span style={{ fontSize: 13, color: 'var(--amber)', flex: 1 }}>{error}</span>
          <button onClick={() => setShowError(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 18, lineHeight: 1, opacity: 0.7 }}>×</button>
        </div>
      )}

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="glass" style={{ borderTop: 'none', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 99 }}>
          {navLinks.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
              color: isActive ? 'var(--text-1)' : 'var(--text-2)',
              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
            })}>{icon}{label}</NavLink>
          ))}
        </div>
      )}

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, var(--indigo), var(--violet))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={10} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>AgentBoard · Built on Arc · Powered by Circle</span>
        </div>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {['ERC-8004', 'ERC-8183', 'USDC Native'].map(t => (
            <span key={t} style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{t}</span>
          ))}
        </div>
      </footer>
      <style>{`@media(max-width:600px){#mob-btn{display:flex!important}}`}</style>
    </div>
  )
}
