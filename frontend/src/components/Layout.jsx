import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { useWallet } from '../hooks/useWallet'
import { useNetwork } from '../hooks/useNetwork'
import { protocolFor } from '../lib/networks'
import NetworkSwitch from './NetworkSwitch'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Zap, ExternalLink, Menu, X, Wallet, ChevronDown, AlertTriangle } from 'lucide-react'

export default function Layout() {
  const { activeAddress, activeMode, agentWallet, openPicker, connecting, disconnect, error: walletError, wrongChain, switchChain } = useWallet()
  const { key: netKey, network, protocolLive } = useNetwork()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [jobCount, setJobCount] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const lenisRef = useRef(null)

  const isLanding = location.pathname === '/'

  useEffect(() => { setMobileOpen(false); setMenuOpen(false) }, [location.pathname])

  // Wallet menu: close on outside tap or Escape.
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return
    const onDown = e => { if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    const onKey = e => { if (e.key === 'Escape') { setMenuOpen(false); setMobileOpen(false) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen, mobileOpen])

  // ── Lenis smooth scroll (mounted once at app root) ──
  // Skipped entirely for users who prefer reduced motion — native instant
  // scroll is the correct behavior there, not a slowed-down version of it.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
    setJobCount(null)
    if (!protocolLive) return
    const proto = protocolFor(netKey)
    let cancelled = false
    async function load() {
      try {
        let n
        if (proto === 'v1') {
          n = Number(await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' }))
        } else {
          // Mainnet: number of V2 listings. Loaded lazily so the V2 code stays out of the main bundle.
          n = await (await import('../protocol/v2')).getListingCount()
        }
        if (!cancelled) setJobCount(n)
      } catch (e) {
        // Non-fatal: the badge keeps its last known value.
        console.warn('[Layout] board count poll failed:', e)
      }
    }
    // First poll is delayed so it does not land in the same instant as the Board page's own reads.
    const initial = setTimeout(load, 1500)
    const t = setInterval(load, 30000)
    return () => { cancelled = true; clearTimeout(initial); clearInterval(t) }
  }, [netKey, protocolLive])

  const allNavLinks = [
    { to: '/board', label: 'Board', badge: jobCount > 0 ? jobCount : null },
    { to: '/post', label: 'Post Job' },
    { to: '/agent-wallet', label: 'Agent Wallet' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/register', label: 'Register' },
    { to: '/docs', label: 'Docs' },
  ]
  // Agent Wallet is Circle-managed and testnet-only; every other link exists on both networks.
  const navLinks = (network.features.circleAgentWallets ? allNavLinks : allNavLinks.filter(l => l.to !== '/agent-wallet'))
    .map(l => (netKey === 'mainnet' && l.to === '/post' ? { ...l, label: 'Post Listing' } : l))

  const isTestnet = netKey === 'testnet'
  const copyAddress = () => { try { navigator.clipboard?.writeText(activeAddress) } catch { /* clipboard blocked */ } setMenuOpen(false) }
  const navStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
    textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s',
    color: isActive ? 'var(--accent)' : 'var(--text-2)', background: isActive ? 'var(--accent-dim)' : 'transparent',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAVBAR ── */}
      <header className="hdr" style={{
        background: scrolled || mobileOpen ? 'rgba(248,247,255,0.95)' : 'transparent',
        backdropFilter: scrolled || mobileOpen ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled || mobileOpen ? 'blur(20px)' : 'none',
        borderBottom: scrolled || mobileOpen ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        <button onClick={() => navigate('/')} className="logo-btn" aria-label="AgentBoard home" style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, padding: 0,
        }}>
          <svg width="34" height="34" viewBox="0 0 34 34" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C5CFC" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="32" height="32" rx="10" fill="url(#logoGrad)" />
            <circle cx="17" cy="17" r="6.5" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.9" />
            <circle cx="17" cy="10.5" r="2.6" fill="#fff" />
          </svg>
          <span className="hdr-logo-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.025em', color: 'var(--text-1)' }}>
            Agent<span style={{ color: 'var(--accent)' }}>Board</span>
          </span>
        </button>

        <nav className="hdr-nav" aria-label="Main">
          {navLinks.map(({ to, label, badge }) => (
            <NavLink key={to} to={to} style={navStyle}>
              {label}
              {badge && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, lineHeight: 1.6 }}>{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="hdr-right">
          <NetworkSwitch compact />
          {activeAddress ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button className="address-pill" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}
                style={{ padding: '6px 9px', minHeight: 34, ...(activeMode === 'agent' ? { borderColor: 'var(--pink-border)', color: 'var(--pink)' } : null) }}>
                <Wallet size={13} />
                <span className="addr-long">{formatAddress(activeAddress)}</span>
                <span className="addr-short">…{activeAddress.slice(-4)}</span>
                {activeMode === 'browser' && wrongChain ? <AlertTriangle size={12} color="var(--amber)" aria-label="Wrong network" /> : <ChevronDown size={12} />}
              </button>
              {menuOpen && (
                <div className="hdr-menu" role="menu">
                  {activeMode === 'browser' && wrongChain && (
                    <button role="menuitem" onClick={() => { setMenuOpen(false); switchChain() }} style={{ color: 'var(--amber)', fontWeight: 700 }}>Switch to {network.label}</button>
                  )}
                  {isTestnet
                    ? <button role="menuitem" onClick={() => { setMenuOpen(false); navigate(`/agent/${activeAddress}`) }}>Profile</button>
                    : <>
                        <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/dashboard') }}>My activity</button>
                        <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/register') }}>My agents</button>
                      </>}
                  <button role="menuitem" onClick={copyAddress}>Copy address</button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); disconnect() }}>Disconnect</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary btn-sm" onClick={openPicker} disabled={connecting} style={{ whiteSpace: 'nowrap', minHeight: 34 }}>
                {connecting
                  ? <><span className="spinner" style={{ width: 11, height: 11 }} /><span className="lbl-long">Connecting…</span></>
                  : <><Wallet size={13} /><span className="lbl-long">Connect Wallet</span><span className="lbl-short">Connect</span></>}
              </button>
              {walletError && (
                <div role="alert" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1.5px solid var(--border)',
                  borderRadius: 10, padding: '8px 13px', fontSize: 12, color: 'var(--red)', zIndex: 200, boxShadow: 'var(--shadow)',
                  width: 'max-content', maxWidth: 'calc(100vw - 24px)',
                }}>{walletError}</div>
              )}
            </div>
          )}
          <button onClick={() => setMobileOpen(o => !o)} className="hdr-burger" aria-label="Toggle menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {network.realFunds && (
        <div role="status" style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 98, textAlign: 'center',
          background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 12px',
        }}>
          Arc Mainnet · real USDC{protocolLive ? '' : ' · contracts not live yet, read-only'}
        </div>
      )}

      {/* ── MOBILE NAV ── */}
      {mobileOpen && (
        <div className="mobile-panel" style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, background: 'rgba(248,247,255,0.98)',
          backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', padding: '12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {navLinks.map(({ to, label, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({ ...navStyle({ isActive }), padding: '12px 14px', fontSize: 15, fontWeight: 600, borderRadius: 10 })}>
              {label}
              {badge && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>{badge}</span>}
            </NavLink>
          ))}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {activeMode === 'browser' && wrongChain && (
              <button onClick={() => { setMobileOpen(false); switchChain() }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--amber-dim)',
                border: '1.5px solid rgba(245,158,11,0.3)', color: 'var(--amber)', fontSize: 13, fontWeight: 700, padding: '10px 14px',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 8,
              }}><AlertTriangle size={12} /> Switch to {network.label}</button>
            )}
            {activeAddress ? (
              <button onClick={() => { setMobileOpen(false); disconnect() }} style={{
                width: '100%', background: 'var(--bg-subtle)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 14px',
                color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left',
              }}>Disconnect {formatAddress(activeAddress)}</button>
            ) : (
              <button onClick={() => { openPicker(); setMobileOpen(false) }} className="btn btn-primary" style={{ width: '100%' }}>Connect Wallet</button>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <main style={{ flex: 1, paddingTop: isLanding ? (network.realFunds ? 28 : 0) : (network.realFunds ? 92 : 64) }}>
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
                Decentralized AI agent commerce on {network.label}.
              </p>
            </div>
            {[
              { title: 'App', links: [{ label: 'Job Board', to: '/board' }, { label: 'Post a Job', to: '/post' }, ...(network.features.circleAgentWallets ? [{ label: 'Agent Wallet', to: '/agent-wallet' }] : []), { label: 'Leaderboard', to: '/leaderboard' }, { label: 'Dashboard', to: '/dashboard' }, { label: 'Register', to: '/register' }] },
              { title: 'Developers', links: [{ label: 'Documentation', to: '/docs' }, { label: 'Architecture', to: '/docs#architecture' }, { label: 'Contract Reference', to: '/docs#contract' }, { label: 'REST API', to: '/docs#api' }] },
              { title: 'Resources', external: [{ label: 'GitHub', url: 'https://github.com/Siriron/agentboard' }, network.realFunds ? { label: 'Job board contract', url: `${network.explorer}/address/${network.contracts.v2.board}` } : { label: 'Contract on ArcScan', url: 'https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4' }, { label: 'Arc Docs', url: 'https://docs.arc.io' }, { label: 'Circle Developers', url: 'https://developers.circle.com' }] },
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
              {[[network.label, network.realFunds ? '#0f766e' : '#10b981'], ['ERC-8183', '#7C5CFC'], ['ERC-8004', '#f472b6']].map(([label, color]) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}28`, padding: '2px 8px', borderRadius: 5, fontFamily: 'var(--font-mono)' }}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
