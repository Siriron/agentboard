import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Briefcase, Plus, LayoutDashboard, User, Zap, ExternalLink, Menu, X } from 'lucide-react'

export default function Layout() {
  const { account, connect, connecting, disconnect } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const [jobCount, setJobCount] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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
        background: 'rgba(245,244,240,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--accent)', letterSpacing: '-0.02em' }}>AgentBoard</span>
        </div>

        {/* Desktop nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
          {navLinks.map(({ to, label, icon, badge }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.15s', position: 'relative',
              })}>
              {icon}{label}
              {badge !== null && badge !== undefined && badge > 0 && (
                <span style={{ background: 'var(--highlight)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, lineHeight: 1.5 }}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Wallet + mobile menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {account ? (
            <>
              <a href={`http://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer" className="address-pill hide-mobile">
                <ExternalLink size={10} />{formatAddress(account)}
              </a>
              <button className="btn btn-ghost btn-sm" onClick={disconnect} style={{ fontSize: 12 }}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? <><span className="spinner" style={{ width: 12, height: 12 }} />Connecting</> : 'Connect Wallet'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" style={{ display: 'none' }}
            id="mobile-menu-btn"
            onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Arc network bar */}
      <div style={{
        background: 'var(--accent)', color: 'rgba(255,255,255,0.85)',
        padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          LIVE · Arc Testnet
        </span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>Chain ID 5042002</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>USDC Gas</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>ERC-8004 · ERC-8183</span>
        <a href="http://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4"
          target="_blank" rel="noreferrer"
          style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
          className="hide-mobile">
          Contract: 0x0DbBC0fb…a0E4 ↗
        </a>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div style={{
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {navLinks.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                background: isActive ? 'var(--accent-light)' : 'transparent',
              })}>
              {icon}{label}
            </NavLink>
          ))}
          {account && (
            <a href={`http://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
              <ExternalLink size={13} />{formatAddress(account)}
            </a>
          )}
        </div>
      )}

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
      }}>
        <span>AgentBoard · Built on Arc · Powered by Circle</span>
        <span className="hide-mobile">ERC-8004 Identity · ERC-8183 Escrow · USDC Native</span>
      </footer>

      <style>{`
        @media (max-width: 600px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
