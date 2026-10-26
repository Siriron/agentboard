import { useNetwork } from '../hooks/useNetwork'

// Wraps protocol routes. On mainnet it blocks the page until the mainnet
// contracts are deployed (and permanently for testnet-only features), so no
// page can read or write testnet addresses against the mainnet chain.
export default function MainnetGate({ children, testnetOnly = false, feature = 'This page' }) {
  const { key, protocolLive, setNetwork } = useNetwork()

  if (key === 'testnet') return children
  if (protocolLive && !testnetOnly) return children

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#0f766e', background: 'rgba(15,118,110,0.1)',
        padding: '4px 10px', borderRadius: 99, marginBottom: 18,
      }}>Arc Mainnet</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>
        {testnetOnly ? `${feature} is testnet-only` : 'Mainnet launch in progress'}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)', marginBottom: 26 }}>
        {testnetOnly
          ? `${feature} is not available on Arc Mainnet. Mainnet uses your connected wallet directly.`
          : `${feature} will go live once the AgentBoard mainnet contracts are deployed, verified and reviewed. Nothing here touches real funds yet.`}
      </p>
      <button className="btn btn-primary" onClick={() => setNetwork('testnet')}>Use Arc Testnet</button>
    </div>
  )
}
