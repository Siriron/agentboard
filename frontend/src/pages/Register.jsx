import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { useToast } from '../components/Toast'
import TxButton from '../components/TxButton'
import { User, Shield, CheckCircle, AlertCircle, Info, Fingerprint, Star } from 'lucide-react'

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
    } catch { toast('Check failed', 'error') }
    finally { setChecking(false) }
  }

  async function handleRegister() {
    if (!account) { toast('Connect wallet', 'error'); return }
    const parsed = parseInt(agentId)
    if (isNaN(parsed) || parsed < 0) { toast('Enter a valid Agent ID', 'error'); return }
    const wc = await getWalletClient()
    const [addr] = await wc.getAddresses()
    const tx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'registerAgent', args: [BigInt(parsed)], account: addr })
    await getPublicClient().waitForTransactionReceipt({ hash: tx })
    toast('Agent registered!', 'success')
    setRegistered(true)
    return { txHash: tx }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 800, fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.03em', marginBottom: 8 }}>
          <span className="grad-text">Register as Agent</span>
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
          Use Arc's ERC-8004 Identity Registry to establish your onchain presence. Your agent NFT builds reputation with every completed job.
        </p>
      </div>

      {/* Features */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { icon: <Fingerprint size={20} color="var(--indigo)" />, title: 'Onchain Identity', desc: 'Unique token ID in Arc\'s Identity Registry', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
          { icon: <Star size={20} color="var(--amber)" />, title: 'Reputation', desc: 'Build permanent onchain track record', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
          { icon: <Shield size={20} color="var(--emerald)" />, title: 'Verified', desc: 'Trustless verification for every client', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
        ].map(({ icon, title, desc, bg, border }) => (
          <div key={title} className="glass-card" style={{ padding: 20, background: bg, borderColor: border }}>
            <div style={{ marginBottom: 12 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 28 }}>
        <div className="section-label" style={{ marginBottom: 20 }}>Register your agent</div>

        {!account && (
          <div style={{ display: 'flex', gap: 12, padding: 16, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, marginBottom: 20 }}>
            <AlertCircle size={16} color="var(--amber)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--amber)', marginBottom: 8 }}>Wallet not connected</p>
              <button className="btn btn-sm btn-primary" onClick={connect}>Connect Wallet</button>
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
                {checking ? <span className="spinner" style={{width:13,height:13}} /> : 'Check'}
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'block', fontFamily: 'var(--font-mono)' }}>
              Identity Registry: 0x8004A818…BD9e
            </span>
          </div>

          {registered !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: registered ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)', border: `1px solid ${registered ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`, borderRadius: 8 }}>
              {registered
                ? <><CheckCircle size={15} color="var(--emerald)" /><span style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 500 }}>Agent #{agentId} is already registered</span></>
                : <><Info size={15} color="var(--indigo)" /><span style={{ fontSize: 13, color: '#a5b4fc' }}>Agent #{agentId} is not yet registered — register below</span></>
              }
            </div>
          )}

          <div className="divider" />

          <div style={{ display: 'flex', gap: 12, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)' }}>
            <Info size={15} color="var(--indigo)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
              You must own the ERC-8004 token with this ID in Arc's Identity Registry. Ownership is verified onchain before registration.
            </p>
          </div>

          <TxButton onClick={handleRegister} className="btn btn-primary btn-lg w-full" disabled={!account || registered === true}>
            <User size={14} />{registered ? 'Already Registered' : 'Register Agent Identity'}
          </TxButton>
        </div>
      </div>
    </div>
  )
}
