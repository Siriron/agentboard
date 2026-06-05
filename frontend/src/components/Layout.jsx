import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Zap, ExternalLink, Menu, X, AlertCircle } from 'lucide-react'

export default function Layout() {
  const { account, connect, connecting, disconnect, error } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showError, setShowError] = useState(false)
  const [jobCount, setJobCount] = useState(null)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  useEffect(() => {
    if (error) { setShowError(true); const t = setTimeout(() => setShowError(false), 6000); return () => clearTimeout(t) }
  }, [error])
  useEffect(() => {
    async function fetch() {
      try {
        const n = await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
        setJobCount(Number(n))
      } catch {}
    }
    fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t)
  }, [])

  const isLanding = location.pathname === '/'
  const navLinks = [
    { to: '/board', label: 'Job Board' },
    { to: '/post', label: 'Post Job' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/register', label: 'Register' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--dark-base)' }}>
      {/* NAV */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 28px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(13,11,30,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(153,69,255,0.5)' }}>
            <Zap size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: '#fff' }}>
            Agent<span style={{ color: 'var(--purple-light)' }}>Board</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              padding: '7px 16px', borderRadius: 'var(--r-pill)', fontSize: 14,
              fontWeight: 500, textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'all 0.15s',
            })}>{label}</NavLink>
          ))}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live badge */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(25,251,155,0.08)', border: '1px solid rgba(25,251,155,0.15)', borderRadius: 'var(--r-pill)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.04em' }}>Arc Testnet</span>
          </div>
          {account ? (
            <>
              <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer" className="address-pill hide-mobile">
                <ExternalLink size={10} />{formatAddress(account)}
              </a>
              <button className="btn btn-secondary btn-sm" onClick={disconnect} style={{ borderRadius: 'var(--r-pill)', fontSize: 13 }}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? <><span className="spinner" style={{ width: 12, height: 12 }} />Connecting…</> : 'Connect Wallet'}
            </button>
          )}
          <button id="mob-btn" onClick={() => setMobileOpen(o => !o)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 6 }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {showError && error && (
        <div style={{ position: 'fixed', top: 68, left: 0, right: 0, zIndex: 99, background: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.2)', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} color="var(--amber)" />
          <span style={{ fontSize: 13, color: 'var(--amber)', flex: 1 }}>{error}</span>
          <button onClick={() => setShowError(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 20 }}>×</button>
        </div>
      )}

      {/* Mobile nav */}
      {mobileOpen && (
        <div style={{ position: 'fixed', top: 68, left: 0, right: 0, zIndex: 98, background: 'rgba(13,11,30,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--dark-border)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'block', padding: '12px 16px', borderRadius: 12,
              fontSize: 16, fontWeight: 600, textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              background: isActive ? 'rgba(153,69,255,0.12)' : 'transparent',
            })}>{label}</NavLink>
          ))}
          {account && (
            <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{account}</div>
          )}
        </div>
      )}

      {/* Main — push below fixed nav */}
      <main style={{ flex: 1, paddingTop: 68 }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--dark-surface)', borderTop: '1px solid var(--dark-border)', padding: '32px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #9945ff, #7c35dd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={13} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#fff' }}>AgentBoard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {['ERC-8004', 'ERC-8183', 'USDC Native', 'Built on Arc'].map(t => (
            <span key={t} style={{ fontSize: 12, color: 'var(--dark-text-3)', fontFamily: 'var(--font-mono)' }}>{t}</span>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--dark-text-3)' }}>© AgentBoard 2026</span>
      </footer>
      <style>{`@media(max-width:600px){#mob-btn{display:flex!important}}`}</style>
    </div>
  )
}
