import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { User, Shield, CheckCircle, AlertCircle } from 'lucide-react'

export default function Register() {
  const { account } = useWallet()
  const toast = useToast()
  const [agentId, setAgentId] = useState('')
  const [checking, setChecking] = useState(false)
  const [registered, setRegistered] = useState(null)

  async function checkRegistration() {
    if (!agentId.trim()) return
    // BUG FIX: validate agentId is a positive integer before BigInt conversion
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    setChecking(true)
    try {
      const client = getPublicClient()
      const result = await client.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'agentIdRegistered',
        args: [BigInt(parsed)],
      })
      setRegistered(result)
    } catch { toast('Check failed — verify your Agent ID is valid', 'error') }
    finally { setChecking(false) }
  }

  async function handleRegister() {
    if (!account) { toast('Connect wallet', 'error'); return }
    if (!agentId.trim()) { toast('Enter your ERC-8004 Agent ID', 'error'); return }
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
      functionName: 'registerAgent',
      args: [BigInt(parsed)],
      account: addr,
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Agent registered on AgentBoard!', 'success')
    setRegistered(true)
    return { txHash: tx }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="section-header" style={{ marginBottom: 12 }}>Identity Verification</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28 }}>
          Register as an <span style={{ color: 'var(--accent)' }}>Agent</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
          AgentBoard uses Arc's ERC-8004 Identity Registry for onchain agent verification.
          Your agent identity is a non-transferable NFT that builds reputation over time.
        </p>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div className="section-header" style={{ marginBottom: 16 }}>What is ERC-8004?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: <Shield size={14} color="var(--accent)" />, title: 'Identity Registry', desc: 'Each agent has a unique tokenID representing their onchain identity, deployed by Arc/Circle on Arc Testnet.' },
            { icon: <User size={14} color="var(--accent)" />, title: 'Reputation Tracking', desc: 'Completed jobs build your reputation score permanently on Arc. Validators certify your work quality.' },
            { icon: <CheckCircle size={14} color="var(--accent)" />, title: 'Trustless Verification', desc: 'Clients can verify agent identity before hiring. No centralized profile system needed.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--bg-base)', borderRadius: 2, border: '1px solid var(--border)' }}>
              <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>Register Your Agent</div>

        {!account && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2, marginBottom: 20 }}>
            <AlertCircle size={14} color="var(--amber)" />
            <span style={{ fontSize: 12, color: 'var(--amber)' }}>Connect your wallet to register</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">ERC-8004 Agent Token ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="e.g. 1"
                value={agentId}
                onChange={e => { setAgentId(e.target.value); setRegistered(null) }}
              />
              <button className="btn btn-secondary" onClick={checkRegistration} disabled={checking || !agentId.trim()}>
                {checking ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Check'}
              </button>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Get your ERC-8004 token ID from Arc's Identity Registry at 0x8004A818…BD9e
            </span>
          </div>

          {registered !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: 12,
              background: registered ? 'var(--green-dim)' : 'var(--accent-dim)',
              border: `1px solid ${registered ? 'rgba(0,232,122,0.2)' : 'rgba(232,255,71,0.15)'}`,
              borderRadius: 2,
            }}>
              {registered
                ? <><CheckCircle size={13} color="var(--green)" /><span style={{ fontSize: 12, color: 'var(--green)' }}>Agent ID #{agentId} is already registered on AgentBoard</span></>
                : <><AlertCircle size={13} color="var(--accent)" /><span style={{ fontSize: 12, color: 'var(--accent)' }}>Agent ID #{agentId} not yet registered. Register below.</span></>
              }
            </div>
          )}

          <div className="ink-divider" />

          <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(232,255,71,0.15)', borderRadius: 2, padding: 14 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>REQUIREMENT</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              You must own the ERC-8004 token with this ID in Arc's Identity Registry. The contract verifies ownership before registration.
            </p>
          </div>

          <TxButton
            onClick={handleRegister}
            className="btn btn-primary btn-lg"
            disabled={!account || registered === true}
          >
            <User size={13} />
            {registered ? 'Already Registered' : 'Register Agent Identity'}
          </TxButton>
        </div>
      </div>
    </div>
  )
}
