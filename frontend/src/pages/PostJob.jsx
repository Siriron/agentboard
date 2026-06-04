import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import TxButton from '../components/TxButton'
import { useToast } from '../components/Toast'
import { AlertCircle, Info, FileText, DollarSign, Calendar, Tag, CheckCircle } from 'lucide-react'

const CATEGORIES = ['smart-contract','data-analysis','content','design','frontend','backend','research','other']

export default function PostJob() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', description: '', category: 'smart-contract', budget: '', deadlineDays: '14' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))
  const [step, setStep] = useState(0) // 0=idle 1=approving 2=posting 3=done

  async function handlePost() {
    if (!form.title.trim() || !form.description.trim() || !form.budget) { toast('Fill all fields', 'error'); return }
    const budgetVal = parseFloat(form.budget)
    if (isNaN(budgetVal) || budgetVal <= 0) { toast('Enter a valid budget', 'error'); return }
    const budgetRaw = BigInt(Math.round(budgetVal * 1e6))
    const deadline = BigInt(Math.floor(Date.now()/1000) + parseInt(form.deadlineDays)*86400)
    const wc = await getWalletClient()
    const pc = getPublicClient()
    const [addr] = await wc.getAddresses()
    setStep(1)
    toast('Approving USDC…', 'info')
    const approveTx = await wc.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, budgetRaw], account: addr })
    await pc.waitForTransactionReceipt({ hash: approveTx })
    toast('USDC approved ✓', 'success')
    setStep(2)
    toast('Posting job…', 'info')
    const postTx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'postJob', args: [form.title.trim(), form.description.trim(), form.category, budgetRaw, deadline], account: addr })
    await pc.waitForTransactionReceipt({ hash: postTx })
    setStep(3)
    toast('Job posted!', 'success')
    setTimeout(() => navigate('/board'), 1500)
    return { txHash: postTx }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 800, fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.03em', marginBottom: 8 }}>
          <span className="grad-text">Post a Job</span>
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Your USDC budget is locked in escrow until work is validated and approved.</p>
      </div>

      {!account ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertCircle size={28} color="var(--indigo)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, letterSpacing: '-0.02em' }}>Wallet Required</p>
          <p style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: 14 }}>Connect your wallet to post a job and escrow USDC.</p>
          <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
        </div>
      ) : (
        <>
          {/* Step indicator */}
          {step > 0 && (
            <div className="glass-card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              {[{label:'Approve USDC'},{label:'Post Job'},{label:'Complete'}].map((s,i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step > i ? 'var(--indigo)' : step === i+1 ? 'var(--indigo-dim)' : 'var(--surface-2)', border: step === i+1 ? '1px solid var(--indigo)' : 'none' }}>
                    {step > i+1 ? <CheckCircle size={13} color="#fff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: step >= i+1 ? '#fff' : 'var(--text-3)' }}>{i+1}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: step >= i+1 ? 'var(--text-1)' : 'var(--text-3)' }}>{s.label}</span>
                  {i < 2 && <div style={{ width: 24, height: 1, background: step > i+1 ? 'var(--indigo)' : 'var(--border)' }} />}
                </div>
              ))}
            </div>
          )}

          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="input-group">
                <label className="input-label"><FileText size={11} style={{display:'inline',marginRight:5}} />Job Title</label>
                <input className="input" placeholder="e.g. Audit ERC-20 smart contract" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea className="input" rows={5} placeholder="Describe the task, requirements, and expected deliverables…" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label"><Tag size={11} style={{display:'inline',marginRight:5}} />Category</label>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-',' ')}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label"><DollarSign size={11} style={{display:'inline',marginRight:5}} />Budget (USDC)</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 50" value={form.budget} onChange={e => set('budget', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label"><Calendar size={11} style={{display:'inline',marginRight:5}} />Deadline (days from today)</label>
                <input className="input" type="number" min="1" max="365" value={form.deadlineDays} onChange={e => set('deadlineDays', e.target.value)} />
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', gap: 12, padding: 16, background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.12)' }}>
                <Info size={16} color="var(--indigo)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#a5b4fc', marginBottom: 4 }}>Two-step transaction</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>Approve USDC spending, then post the job with{form.budget ? ` $${form.budget}` : ' your budget'} locked in escrow. 1% platform fee on release.</p>
                </div>
              </div>
              <TxButton onClick={handlePost} className="btn btn-primary btn-lg w-full">
                Escrow &amp; Post Job
              </TxButton>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
