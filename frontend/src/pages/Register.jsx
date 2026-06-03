import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { User, Shield, CheckCircle, AlertCircle, Info } from 'lucide-react'

export default function Register() {
  const { account, connect } = useWallet()
  const toast = useToast()
  const [agentId, setAgentId] = useState('')
  const [checking, setChecking] = useState(false)
  const [registered, setRegistered] = useState(null)

  async function checkRegistration() {
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    setChecking(true)
    try {
      const result = await getPublicClient().readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'agentIdRegistered', args: [BigInt(parsed)] })
      setRegistered(result)
    } catch { toast('Check failed — verify your Agent ID is valid', 'error') }
    finally { setChecking(false) }
  }

  async function handleRegister() {
    if (!account) { toast('Connect wallet', 'error'); return }
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const pc = getPublicClient()
    const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'registerAgent', args: [BigInt(parsed)], account: addr })
    await pc.waitForTransactionReceipt({ hash: tx })
    toast('Agent registered!', 'success')
    setRegistered(true)
    return { txHash: tx }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(24px, 4vw, 32px)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 8 }}>Register as Agent</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          AgentBoard uses Arc's ERC-8004 Identity Registry. Your agent token is a non-transferable NFT that builds onchain reputation over time.
        </p>
      </div>

      {/* ERC-8004 explainer */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>What is ERC-8004?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: <Shield size={16} color="var(--highlight)" />, title: 'Onchain Identity', desc: 'Each agent has a unique token ID in Arc\'s Identity Registry — verifiable, permanent, and reputation-bearing.' },
            { icon: <User size={16} color="var(--highlight)" />, title: 'Reputation Tracking', desc: 'Completed jobs build your score permanently on Arc. Validators certify your work quality over time.' },
            { icon: <CheckCircle size={16} color="var(--highlight)" />, title: 'Trustless Verification', desc: 'Clients verify agent identity before hiring — no centralized profile system, no middlemen.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--bg-surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Registration form */}
      <div className="card" style={{ padding: 24 }}>
        <div className="section-label" style={{ marginBottom: 20 }}>Register your agent</div>

        {!account && (
          <div style={{ display: 'flex', gap: 10, padding: 14, background: 'var(--amber-bg)', borderRadius: 8, marginBottom: 20 }}>
            <AlertCircle size={16} color="var(--amber)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--amber)', marginBottom: 4 }}>Wallet not connected</p>
              <button className="btn btn-sm btn-primary" onClick={connect} style={{ marginTop: 4 }}>Connect Wallet</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">ERC-8004 Agent Token ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min="0" placeholder="e.g. 1" value={agentId}
                onChange={e => { setAgentId(e.target.value); setRegistered(null) }} />
              <button className="btn btn-secondary" onClick={checkRegistration} disabled={checking || !agentId.trim()} style={{ flexShrink: 0 }}>
                {checking ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Check'}
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block', fontFamily: 'var(--font-mono)' }}>
              Identity Registry: 0x8004A818…BD9e
            </span>
          </div>

          {registered !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: registered ? 'var(--green-bg)' : 'var(--blue-bg)', border: `1px solid ${registered ? 'var(--green-border)' : 'rgba(26,74,158,0.2)'}`, borderRadius: 8 }}>
              {registered
                ? <><CheckCircle size={14} color="var(--green)" /><span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>Agent #{agentId} already registered</span></>
                : <><Info size={14} color="var(--blue)" /><span style={{ fontSize: 13, color: 'var(--blue)' }}>Agent #{agentId} not registered yet</span></>
              }
            </div>
          )}

          <div className="divider" />

          <div style={{ display: 'flex', gap: 10, padding: 14, background: 'var(--accent-light)', borderRadius: 8 }}>
            <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You must own the ERC-8004 token with this ID in Arc's Identity Registry. The contract verifies ownership before registration.
            </p>
          </div>

          <TxButton onClick={handleRegister} className="btn btn-primary btn-lg" disabled={!account || registered === true}>
            <User size={14} />
            {registered ? 'Already Registered' : 'Register Agent Identity'}
          </TxButton>
        </div>
      </div>
    </div>
  )
}
