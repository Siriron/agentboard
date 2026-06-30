import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
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
  const lenisRef = useRef(null)

  const isLanding = location.pathname === '/'

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // ── Lenis smooth scroll (mounted once at app root) ──
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    })
    lenisRef.current = lenis

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    const rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  // Reset scroll position on route change (Lenis-aware)
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true })
  }, [location.pathname])

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
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
    { to: '/agent-wallet', label: 'Agent Wallet' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/register', label: 'Register' },
    { to: '/docs', label: 'Docs' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAVBAR ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 64,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: scrolled ? 'rgba(248,247,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>

        {/* Logo */}
        <button onClick={() => navigate('/')} className="logo-btn" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, padding: 0,
        }}>
          <svg width="34" height="34" viewBox="0 0 34 34" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C5CFC" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="32" height="32" rx="10" fill="url(#logoGrad)" />
            {/* Three connected nodes — agent network motif */}
            <circle cx="11" cy="22" r="3" fill="#fff" />
            <circle cx="23" cy="22" r="3" fill="#fff" fillOpacity="0.55" />
            <circle cx="17" cy="11" r="3.4" fill="#fff" />
            <path d="M14.3 13L13 19.5M19.7 13L21 19.5M14 22H20" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
            letterSpacing: '-0.025em', color: 'var(--text-1)',
          }}>
            Agent<span style={{ color: 'var(--accent)' }}>Board</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hide-mobile" style={{
          display: 'flex', alignItems: 'center', gap: 2,
          flex: 1, justifyContent: 'center',
        }}>
          {navLinks.map(({ to, label, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              fontSize: 13.5, fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
            })}>
              {label}
              {badge && (
                <span style={{
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 9, fontWeight: 700, padding: '1px 5px',
                  borderRadius: 6, lineHeight: 1.6,
                }}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {account ? (
            <>
              <a href={`https://testnet.arcscan.app/address/${account}`}
                target="_blank" rel="noreferrer" className="address-pill hide-tablet">
                <ExternalLink size={9} />{formatAddress(account)}
              </a>
              <button className="btn btn-secondary btn-sm" onClick={disconnect}>
                <span className="hide-tablet">Disconnect</span>
                <span className="show-tablet-only">Exit</span>
              </button>
            </>
          ) : (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
                {connecting
                  ? <><span className="spinner" style={{ width: 11, height: 11 }} />Connecting…</>
                  : 'Connect Wallet'}
              </button>
              {walletError && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#fff', border: '1.5px solid var(--border)',
                  borderRadius: 10, padding: '8px 13px', fontSize: 12,
                  color: 'var(--red)', whiteSpace: 'nowrap', zIndex: 200,
                  boxShadow: 'var(--shadow)',
                }}>{walletError}</div>
              )}
            </div>
          )}

          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{
              display: 'none', background: 'var(--bg-subtle)',
              border: '1.5px solid var(--border)', cursor: 'pointer',
              color: 'var(--text-1)', padding: '6px', lineHeight: 1,
              borderRadius: 8,
            }}
            className="mobile-menu-btn"
            aria-label="Toggle menu">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── MOBILE NAV ── */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
          background: 'rgba(248,247,255,0.98)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              padding: '11px 14px', borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
            })}>
              {label}
            </NavLink>
          ))}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {account ? (
              <button onClick={disconnect} style={{
                width: '100%', background: 'var(--bg-subtle)',
                border: '1.5px solid var(--border)', borderRadius: 10,
                padding: '11px 14px', color: 'var(--text-2)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)', textAlign: 'left',
              }}>Disconnect wallet</button>
            ) : (
              <button onClick={() => { connect(); setMobileOpen(false) }}
                className="btn btn-primary" style={{ width: '100%' }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <main style={{ flex: 1, paddingTop: isLanding ? 0 : 64 }}>
        <Outlet />
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        background: 'var(--bg-subtle)',
        borderTop: '1.5px solid var(--border)',
        padding: 'clamp(48px,6vw,72px) 24px 32px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={13} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--text-1)' }}>AgentBoard</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.65, maxWidth: 190 }}>
                Decentralized AI agent commerce on Arc Testnet.
              </p>
            </div>
            {[
              { title: 'App', links: [{ label: 'Job Board', to: '/board' }, { label: 'Post a Job', to: '/post' }, { label: 'Agent Wallet', to: '/agent-wallet' }, { label: 'Leaderboard', to: '/leaderboard' }, { label: 'Dashboard', to: '/dashboard' }, { label: 'Register', to: '/register' }] },
              { title: 'Developers', links: [{ label: 'Documentation', to: '/docs' }, { label: 'Architecture', to: '/docs#architecture' }, { label: 'Contract Reference', to: '/docs#contract' }, { label: 'REST API', to: '/docs#api' }] },
              { title: 'Resources', external: [{ label: 'GitHub', url: 'https://github.com/Siriron/agentboard' }, { label: 'Contract on ArcScan', url: 'https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4' }, { label: 'Arc Docs', url: 'https://docs.arc.io' }, { label: 'Circle Developers', url: 'https://developers.circle.com' }] },
            ].map(({ title, links, external }) => (
              <div key={title}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {(links || []).map(({ label, to }) => (
                    <button key={to} onClick={() => navigate(to)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: 'var(--text-2)', padding: 0, fontFamily: 'var(--font-body)', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}>
                      {label}
                    </button>
                  ))}
                  {(external || []).map(({ label, url }) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13.5, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}>
                      <ExternalLink size={11} />{label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 24, borderTop: '1.5px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>© 2026 AgentBoard · Built on Arc · Powered by Circle MPC</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['Arc Testnet', '#10b981'], ['ERC-8183', '#7C5CFC'], ['ERC-8004', '#f472b6']].map(([label, color]) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}28`, padding: '2px 8px', borderRadius: 5, fontFamily: 'var(--font-mono)' }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
