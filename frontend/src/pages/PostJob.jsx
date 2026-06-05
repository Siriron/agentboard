import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import TxButton from '../components/TxButton'
import { useToast } from '../components/Toast'
import { AlertCircle, Info, CheckCircle, Zap } from 'lucide-react'

const CATEGORIES = ['smart-contract','data-analysis','content','design','frontend','backend','research','other']

export default function PostJob() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', description: '', category: 'smart-contract', budget: '', deadlineDays: '14' })
  const [step, setStep] = useState(0)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handlePost() {
    if (!form.title.trim() || !form.description.trim() || !form.budget) { toast('Fill all fields', 'error'); return }
    const budgetVal = parseFloat(form.budget)
    if (isNaN(budgetVal) || budgetVal <= 0) { toast('Enter a valid budget', 'error'); return }
    const budgetRaw = BigInt(Math.round(budgetVal * 1e6))
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(form.deadlineDays) * 86400)
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
    <div className="section-dark" style={{ minHeight: '100vh', padding: '60px 24px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, top: 0, right: 0, background: 'radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)' }} />
      <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 className="display-md" style={{ marginBottom: 10 }}><span className="text-gradient">Post a Job</span></h1>
          <p style={{ color: 'var(--dark-text-2)', fontSize: 15 }}>Lock USDC in escrow until work is validated and approved on Arc.</p>
        </div>

        {!account ? (
          <div className="card-dark" style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <AlertCircle size={32} color="var(--purple-light)" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, marginBottom: 10, letterSpacing: '-0.02em' }}>Wallet Required</h3>
            <p style={{ color: 'var(--dark-text-2)', marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>Connect your wallet to post a job and lock USDC in escrow.</p>
            <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            {step > 0 && (
              <div className="card-dark" style={{ padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 0 }}>
                {[{ label: 'Approve USDC' }, { label: 'Post Job' }, { label: 'Done' }].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step > i ? 'var(--purple)' : step === i + 1 ? 'var(--purple-dim)' : 'rgba(255,255,255,0.05)', border: step === i + 1 ? '1px solid var(--purple)' : 'none', transition: 'all 0.3s', flexShrink: 0 }}>
                        {step > i + 1 ? <CheckCircle size={14} color="#fff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: step >= i + 1 ? '#fff' : 'var(--dark-text-3)' }}>{i + 1}</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: step >= i + 1 ? 'var(--dark-text-1)' : 'var(--dark-text-3)', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                    {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? 'var(--purple)' : 'var(--dark-border)', margin: '0 12px', transition: 'all 0.3s' }} />}
                  </div>
                ))}
              </div>
            )}

            <div className="card-dark" style={{ padding: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div className="input-group">
                  <label className="input-label input-label-dark">Job Title</label>
                  <input className="input" placeholder="e.g. Audit ERC-20 smart contract" value={form.title} onChange={e => set('title', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label input-label-dark">Description</label>
                  <textarea className="input" rows={5} placeholder="Describe the task, requirements, and expected deliverables…" value={form.description} onChange={e => set('description', e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="input-group">
                    <label className="input-label input-label-dark">Category</label>
                    <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label-dark">Budget (USDC)</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 50" value={form.budget} onChange={e => set('budget', e.target.value)} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label input-label-dark">Deadline (days from today)</label>
                  <input className="input" type="number" min="1" max="365" value={form.deadlineDays} onChange={e => set('deadlineDays', e.target.value)} />
                </div>
                <div style={{ height: 1, background: 'var(--dark-border)' }} />
                <div style={{ display: 'flex', gap: 14, padding: 18, background: 'rgba(153,69,255,0.06)', borderRadius: 12, border: '1px solid rgba(153,69,255,0.12)' }}>
                  <Info size={17} color="var(--purple-light)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--purple-light)', marginBottom: 5 }}>Two-step transaction</p>
                    <p style={{ fontSize: 13, color: 'var(--dark-text-2)', lineHeight: 1.55 }}>Approve USDC spending, then post the job with{form.budget ? ` $${form.budget}` : ' your budget'} locked in escrow. 1% platform fee on release.</p>
                  </div>
                </div>
                <TxButton onClick={handlePost} className="btn btn-primary btn-lg w-full">
                  <Zap size={16} /> Escrow &amp; Post Job
                </TxButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
