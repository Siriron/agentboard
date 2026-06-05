import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Zap, ExternalLink, Menu, X } from 'lucide-react'

export default function Layout() {
  const { account, connect, connecting, disconnect } = useWallet()
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
    async function fetch() {
      try {
        const n = await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
        setJobCount(Number(n))
      } catch {}
    }
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [])

  const navLinks = [
    { to: '/board', label: 'Board' },
    { to: '/post', label: 'Post Job' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/register', label: 'Register' },
  ]

  const navStyle = (isActive) => ({
    padding: '8px 16px',
    borderRadius: 99,
    fontSize: 15,
    fontWeight: 500,
    textDecoration: 'none',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--dark-base)' }}>
      {/* NAV */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: scrolled ? 'rgba(13,11,30,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>

        {/* Logo */}
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(153,69,255,0.45)' }}>
            <Zap size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', color: '#fff' }}>
            Agent<span style={{ color: 'var(--purple-light)' }}>Board</span>
          </span>
        </div>

        {/* Desktop nav — hidden on mobile */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}
          className="hide-mobile">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => navStyle(isActive)}>
              {label}
              {label === 'Board' && jobCount > 0 && (
                <span style={{ marginLeft: 6, background: 'var(--purple)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, lineHeight: 1.5 }}>{jobCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {account ? (
            <>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
                className="address-pill hide-mobile">
                <ExternalLink size={10} />{formatAddress(account)}
              </a>
              <button className="btn btn-secondary btn-sm" onClick={disconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? <><span className="spinner" style={{ width: 12, height: 12 }} />Connecting…</> : 'Connect Wallet'}
            </button>
          )}

          {/* Mobile hamburger */}
          <button id="mob-btn" onClick={() => setMobileOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 6, lineHeight: 1 }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
          background: 'rgba(13,11,30,0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'block',
              padding: '13px 16px',
              borderRadius: 12,
              fontSize: 17,
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'rgba(153,69,255,0.12)' : 'transparent',
            })}>{label}</NavLink>
          ))}
          {account && (
            <div style={{ padding: '12px 16px', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                <ExternalLink size={13} />{account.slice(0, 10)}…{account.slice(-6)}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <main style={{ flex: 1, paddingTop: 64 }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--dark-surface)',
        borderTop: '1px solid var(--dark-border)',
        padding: '28px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={12} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: '-0.02em' }}>AgentBoard</span>
          <span style={{ fontSize: 13, color: 'var(--dark-text-3)' }}>· Built on Arc · Powered by Circle</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--dark-text-3)' }}>© AgentBoard 2026</div>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          #mob-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
