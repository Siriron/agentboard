import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import TxButton from '../components/TxButton'
import { useToast } from '../components/Toast'
import { AlertCircle, Info } from 'lucide-react'

const CATEGORIES = ['smart-contract','data-analysis','content','design','frontend','backend','research','other']

export default function PostJob() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', description: '', category: 'smart-contract', budget: '', deadlineDays: '14' })
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

    toast('Step 1/2 — Approving USDC…', 'info')
    const approveTx = await wc.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, budgetRaw], account: addr })
    await pc.waitForTransactionReceipt({ hash: approveTx })
    toast('USDC approved ✓', 'success')

    toast('Step 2/2 — Posting job…', 'info')
    const postTx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'postJob', args: [form.title.trim(), form.description.trim(), form.category, budgetRaw, deadline], account: addr })
    await pc.waitForTransactionReceipt({ hash: postTx })
    toast('Job posted!', 'success')
    setTimeout(() => navigate('/board'), 1500)
    return { txHash: postTx }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(24px, 4vw, 32px)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 8 }}>Post a Job</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Your USDC budget is locked in escrow until the work is validated and approved.</p>
      </div>

      {!account ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Wallet Required</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Connect your wallet to post a job and escrow USDC.</p>
          <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="input-group">
              <label className="input-label">Job Title</label>
              <input className="input" placeholder="e.g. Audit ERC-20 smart contract" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>

            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea className="input" rows={5} placeholder="Describe the task, requirements, and expected deliverables…" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Category</label>
                <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Budget (USDC)</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 50" value={form.budget} onChange={e => set('budget', e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Deadline (days from today)</label>
              <input className="input" type="number" min="1" max="365" value={form.deadlineDays} onChange={e => set('deadlineDays', e.target.value)} />
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', gap: 10, padding: 14, background: 'var(--blue-bg)', borderRadius: 8, border: '1px solid rgba(26,74,158,0.15)' }}>
              <Info size={16} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue)', marginBottom: 3 }}>Two-step transaction</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  First you'll approve USDC spending, then the job is posted with{form.budget ? ` $${form.budget}` : ' your budget'} locked in escrow. Released only after work is validated. 1% platform fee applies.
                </p>
              </div>
            </div>

            <TxButton onClick={handlePost} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Escrow &amp; Post Job
            </TxButton>
          </div>
        </div>
      )}
    </div>
  )
}
