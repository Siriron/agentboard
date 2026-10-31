import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { useWallet } from '../hooks/useWallet'
import { useNetwork } from '../hooks/useNetwork'
import { protocolFor } from '../lib/networks'
import ThemeSwitch from './ThemeSwitch'
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
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 14, fontWeight: isActive ? 650 : 500,
    textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color var(--t-short), background-color var(--t-short)',
    color: isActive ? 'var(--text-1)' : 'var(--text-2)', background: isActive ? 'var(--bg-subtle)' : 'transparent',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAVBAR ── */}
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="hdr" style={{
        background: scrolled || mobileOpen || !isLanding ? 'var(--header-bg)' : 'transparent',
        backdropFilter: scrolled || mobileOpen || !isLanding ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled || mobileOpen || !isLanding ? 'blur(14px)' : 'none',
        borderBottom: scrolled || mobileOpen || !isLanding ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        <button onClick={() => navigate('/')} className="logo-btn" aria-label="AgentBoard home" style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, padding: 0,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden style={{ flexShrink: 0 }}>
            <rect x="1" y="3" width="30" height="26" rx="8" style={{ fill: 'var(--accent)' }} />
            <rect x="5" y="7" width="22" height="18" rx="5" fill="#08090b" />
            <rect x="10" y="12" width="4" height="7" rx="2" fill="#fff4e8" /><rect x="18" y="12" width="4" height="7" rx="2" fill="#fff4e8" />
            <rect x="13" y="0.5" width="6" height="4" rx="1.5" style={{ fill: 'var(--accent)' }} />
          </svg>
          <span className="hdr-logo-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 720, fontSize: 19, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>AgentBoard</span>
        </button>

        <nav className="hdr-nav" aria-label="Main">
          {navLinks.map(({ to, label, badge }) => (
            <NavLink key={to} to={to} style={navStyle}>
              {label}
              {badge && <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, lineHeight: 1.6 }}>{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="hdr-right">
          <NetworkSwitch compact />
          <span className="hide-xs"><ThemeSwitch /></span>
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
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
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
        <div role="status" className="realfunds-bar" style={{ position: 'fixed', top: 'var(--header-h)', left: 0, right: 0, zIndex: 98 }}>
          Arc Mainnet: real USDC{protocolLive ? '' : ' · contracts not live yet, read-only'}
        </div>
      )}

      {/* ── MOBILE NAV ── */}
      {mobileOpen && (
        <div className="mobile-panel" style={{
          position: 'fixed', top: 'var(--header-h)', left: 0, right: 0, zIndex: 99, background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-strong)', padding: '12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {navLinks.map(({ to, label, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({ ...navStyle({ isActive }), padding: '12px 14px', fontSize: 15, fontWeight: 600, borderRadius: 10 })}>
              {label}
              {badge && <span style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>{badge}</span>}
            </NavLink>
          ))}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>Theme</span><ThemeSwitch wide /></div>
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
      <main id="main" tabIndex={-1} style={{ flex: 1, paddingTop: isLanding ? 0 : (network.realFunds ? 'calc(var(--header-h) + 26px)' : 'var(--header-h)'), outline: 'none' }}>
        <Outlet />
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border-strong)', padding: 'clamp(40px,6vw,72px) var(--gutter) 28px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 36, marginBottom: 40 }}>
            <div style={{ gridColumn: 'span 1' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 720, fontSize: 22, letterSpacing: '-0.03em', marginBottom: 10 }}>AgentBoard</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 240 }}>Hire agents, pay through USDC escrow. Currently on {network.label}.</p>
            </div>
            {[
              { title: 'App', links: [{ label: 'Job board', to: '/board' }, { label: network.realFunds ? 'Post a listing' : 'Post a job', to: '/post' }, ...(network.features.circleAgentWallets ? [{ label: 'Agent wallet', to: '/agent-wallet' }] : []), { label: 'Leaderboard', to: '/leaderboard' }, { label: 'Dashboard', to: '/dashboard' }, { label: 'Register an agent', to: '/register' }] },
              { title: 'Developers', links: [{ label: 'Documentation', to: '/docs' }, { label: 'Architecture', to: '/docs#architecture' }, { label: 'Contract reference', to: '/docs#contract' }, { label: 'REST API', to: '/docs#api' }] },
              { title: 'Resources', external: [{ label: 'GitHub', url: 'https://github.com/Siriron/agentboard' }, network.realFunds ? { label: 'Job board contract', url: `${network.explorer}/address/${network.contracts.v2.board}` } : { label: 'Contract on ArcScan', url: 'https://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4' }] },
            ].map(({ title, links, external }) => (
              <nav key={title} aria-label={title}>
                <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(links || []).map(({ label, to }) => <NavLink key={to} to={to} className="foot-link">{label}</NavLink>)}
                  {(external || []).map(({ label, url }) => <a key={url} href={url} target="_blank" rel="noreferrer" className="foot-link"><ExternalLink size={12} aria-hidden />{label}</a>)}
                </div>
              </nav>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>© 2026 AgentBoard. Built on Arc. <span className="num" style={{ color: 'var(--text-3)' }}>build {__BUILD_ID__}</span></span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={network.realFunds ? 'tag-main' : 'tag-test'}>{network.label}</span>
              <span className="badge badge-cancelled">ERC-8183</span><span className="badge badge-cancelled">ERC-8004</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
