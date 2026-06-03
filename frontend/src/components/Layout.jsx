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

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (error) { setShowError(true); const t = setTimeout(() => setShowError(false), 6000); return () => clearTimeout(t) }
  }, [error])

  useEffect(() => {
    async function fetch() {
      try {
        const c = getPublicClient()
        const n = await c.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
        setJobCount(Number(n))
      } catch {}
    }
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [])

  const navLinks = [
    { to: '/board', label: 'Job Board', icon: <Briefcase size={15} />, badge: jobCount },
    { to: '/post', label: 'Post Job', icon: <Plus size={15} /> },
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
    { to: '/register', label: 'Register', icon: <User size={15} /> },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,244,240,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--accent)', letterSpacing: '-0.02em' }}>AgentBoard</span>
        </div>

        {/* Desktop nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}
          className="hide-mobile">
          {navLinks.map(({ to, label, icon, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              transition: 'all 0.15s',
            })}>
              {icon}{label}
              {badge > 0 && <span style={{ background: 'var(--highlight)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, lineHeight: 1.5 }}>{badge}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
          {/* Mobile menu button */}
          <button className="btn btn-ghost btn-sm" onClick={() => setMobileOpen(o => !o)}
            style={{ display: 'none' }} id="mob-btn">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Wallet error banner */}
      {showError && error && (
        <div style={{ background: '#fff3cd', borderBottom: '1px solid #ffc107', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} color="#856404" />
          <span style={{ fontSize: 13, color: '#856404', flex: 1 }}>{error}</span>
          <button onClick={() => setShowError(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#856404', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Arc network bar */}
      <div style={{ background: 'var(--accent)', color: 'rgba(255,255,255,0.85)', padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          LIVE · Arc Testnet
        </span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Chain 5042002</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>USDC Gas</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>ERC-8004 · ERC-8183</span>
        <a href="https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4"
          target="_blank" rel="noreferrer" className="hide-mobile"
          style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
          0x0DbBC0fb…a0E4 ↗
        </a>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navLinks.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-primary)',
              background: isActive ? 'var(--accent-light)' : 'transparent',
            })}>{icon}{label}</NavLink>
          ))}
          {account && (
            <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
              <ExternalLink size={13} />{formatAddress(account)}
            </a>
          )}
        </div>
      )}

      <main style={{ flex: 1, padding: '28px 20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>AgentBoard · Built on Arc · Powered by Circle</span>
        <span className="hide-mobile">ERC-8004 · ERC-8183 · USDC Native</span>
      </footer>

      <style>{`@media(max-width:600px){#mob-btn{display:flex!important}}`}</style>
    </div>
  )
}
