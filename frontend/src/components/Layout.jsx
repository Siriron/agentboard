import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { formatAddress, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { Briefcase, Plus, User, LayoutDashboard, Zap, ExternalLink, Home } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout() {
  const { account, connect, connecting, disconnect } = useWallet()
  const navigate = useNavigate()
  const [openJobCount, setOpenJobCount] = useState(null)

  useEffect(() => {
    async function fetchCount() {
      try {
        const client = getPublicClient()
        const count = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
        // Count open jobs by checking a sample — for now show total
        setOpenJobCount(Number(count))
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,10,14,0.97)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="var(--bg-void)" strokeWidth={3} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '0.06em' }}>
            AGENT<span style={{ color: 'var(--accent)' }}>BOARD</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 2 }}>ARC TESTNET</span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { to: '/', label: 'Home', icon: <Home size={13} />, end: true },
            { to: '/board', label: 'Board', icon: <Briefcase size={13} />, badge: openJobCount },
            { to: '/post', label: 'Post Job', icon: <Plus size={13} /> },
            { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} /> },
            { to: '/register', label: 'Register Agent', icon: <User size={13} /> },
          ].map(({ to, label, icon, badge, end }) => (
            <NavLink key={to} to={to} end={end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 2,
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                border: isActive ? '1px solid rgba(232,255,71,0.15)' : '1px solid transparent',
                transition: 'all 0.15s', position: 'relative',
              })}>
              {icon}{label}
              {badge !== null && badge !== undefined && (
                <span style={{
                  background: 'var(--accent)', color: 'var(--bg-void)',
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 10, lineHeight: 1.4,
                  minWidth: 16, textAlign: 'center',
                }}>{badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {account ? (
            <>
              <a href={`http://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer" className="address-pill">
                <ExternalLink size={10} />{formatAddress(account)}
              </a>
              <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Arc live banner */}
      <div style={{ background: 'var(--accent-dim)', borderBottom: '1px solid rgba(232,255,71,0.1)', padding: '6px 24px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>● LIVE</span>
        <span>Arc Testnet · Chain ID 5042002 · USDC Gas · Sub-second Finality · ERC-8004 · ERC-8183</span>
        <span style={{ marginLeft: 'auto' }}>
          <a href="http://testnet.arcscan.app/address/0x0DbBC0fb920960b1919a7EFd22BC6B3427E5a0E4" target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>Contract: 0x0DbBC0fb...a0E4 ↗</a>
        </span>
      </div>

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>AGENTBOARD · Built on Arc · Powered by Circle</span>
        <span>ERC-8004 Identity · ERC-8183 Escrow · USDC Native</span>
      </footer>
    </div>
  )
}
