import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/arc'
import { useToast } from '../components/Toast'
import { useReveal } from '../hooks/useReveal'
import TxButton from '../components/TxButton'
import { User, Shield, CheckCircle, AlertCircle, Info, Fingerprint, Star } from 'lucide-react'

export default function Register() {
  const { account, connect } = useWallet()
  const toast = useToast()
  const [agentId, setAgentId] = useState('')
  const [checking, setChecking] = useState(false)
  const [registered, setRegistered] = useState(null)
  useReveal()

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
    <div className="section-dark" style={{ minHeight: '100vh', padding: '60px 24px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 500, height: 500, top: '-10%', right: '-10%', background: 'radial-gradient(circle, rgba(153,69,255,0.07) 0%, transparent 70%)' }} />
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 className="display-md" style={{ marginBottom: 10 }}><span className="text-gradient">Register as Agent</span></h1>
          <p style={{ color: 'var(--dark-text-2)', fontSize: 15, lineHeight: 1.65 }}>Use Arc's ERC-8004 Identity Registry to establish your onchain presence.</p>
        </div>

        <div className="grid-3 reveal" style={{ marginBottom: 24 }}>
          {[
            { icon: <Fingerprint size={22} color="var(--purple-light)" />, title: 'Onchain Identity', desc: "Unique token in Arc's registry", bg: 'rgba(153,69,255,0.08)', border: 'rgba(153,69,255,0.15)' },
            { icon: <Star size={22} color="var(--amber)" />, title: 'Reputation', desc: 'Permanent onchain track record', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
            { icon: <Shield size={22} color="var(--green)" />, title: 'Verified', desc: 'Trustless client verification', bg: 'rgba(25,251,155,0.08)', border: 'rgba(25,251,155,0.15)' },
          ].map(({ icon, title, desc, bg, border }) => (
            <div key={title} className="card-dark reveal" style={{ padding: 22, background: bg, borderColor: border }}>
              <div style={{ marginBottom: 12 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--dark-text-2)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div className="card-dark reveal" style={{ padding: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dark-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>Register your agent</div>

          {!account && (
            <div style={{ display: 'flex', gap: 14, padding: 16, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, marginBottom: 22 }}>
              <AlertCircle size={17} color="var(--amber)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--amber)', marginBottom: 10 }}>Wallet not connected</p>
                <button className="btn btn-primary btn-sm" onClick={connect}>Connect Wallet</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label input-label-dark">ERC-8004 Agent Token ID</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" type="number" min="0" placeholder="e.g. 1" value={agentId} onChange={e => { setAgentId(e.target.value); setRegistered(null) }} />
                <button className="btn btn-secondary" onClick={checkRegistration} disabled={checking || !agentId.trim()} style={{ flexShrink: 0 }}>
                  {checking ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Check'}
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--dark-text-3)', fontFamily: 'var(--font-mono)', marginTop: 4, display: 'block' }}>Identity Registry: 0x8004A818…BD9e</span>
            </div>

            {registered !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: registered ? 'rgba(25,251,155,0.06)' : 'rgba(153,69,255,0.06)', border: `1px solid ${registered ? 'rgba(25,251,155,0.2)' : 'rgba(153,69,255,0.2)'}`, borderRadius: 10 }}>
                {registered
                  ? <><CheckCircle size={15} color="var(--green)" /><span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>Agent #{agentId} already registered</span></>
                  : <><Info size={15} color="var(--purple-light)" /><span style={{ fontSize: 13, color: 'var(--purple-light)' }}>Agent #{agentId} not yet registered</span></>
                }
              </div>
            )}

            <div style={{ height: 1, background: 'var(--dark-border)' }} />

            <div style={{ display: 'flex', gap: 14, padding: 16, background: 'rgba(153,69,255,0.06)', borderRadius: 12, border: '1px solid rgba(153,69,255,0.1)' }}>
              <Info size={16} color="var(--purple-light)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: 'var(--dark-text-2)', lineHeight: 1.55 }}>You must own the ERC-8004 token in Arc's Identity Registry. Ownership is verified onchain before registration.</p>
            </div>

            <TxButton onClick={handleRegister} className="btn btn-primary btn-lg w-full" disabled={!account || registered === true}>
              <User size={15} />{registered ? 'Already Registered' : 'Register Agent Identity'}
            </TxButton>
          </div>
        </div>
      </div>
    </div>
  )
}
