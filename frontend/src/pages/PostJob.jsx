import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getWalletClient, getPublicClient, sendBatchTransaction, CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { cn } from '../lib/utils'
import { AlertCircle, Info, CheckCircle, Zap, Layers, Wallet, DollarSign, Calendar, Tag, FileText, Type } from 'lucide-react'

const CATEGORIES = ['SmartContract','Frontend','Backend','Audit','Research','Design','Data','DevOps','Other']

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[var(--text-1)]/40 text-xs font-bold uppercase tracking-wider mb-2">
        {icon}{label}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)] placeholder-white/20 text-sm outline-none focus:border-purple-500/40 focus:bg-[var(--bg-subtle)][0.05] transition-all"

export default function PostJob() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', description: '', category: 'SmartContract', budget: '', deadlineDays: '14' })
  const [step, setStep] = useState(0)
  const [batchMode, setBatchMode] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handlePost() {
    if (!form.title.trim() || !form.description.trim() || !form.budget) { toast('Fill all fields', 'error'); return }
    const budgetVal = parseFloat(form.budget)
    if (isNaN(budgetVal) || budgetVal <= 0) { toast('Enter a valid budget', 'error'); return }
    const budgetRaw = BigInt(Math.round(budgetVal * 1e6))
    const deadline = BigInt(Math.floor(Date.now() / 1000) + parseInt(form.deadlineDays) * 86400)
    setSubmitting(true)

    if (batchMode) {
      setStep(1)
      toast('Signing Arc batch transaction…', 'info')
      try {
        const txHash = await sendBatchTransaction([
          { to: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, budgetRaw] },
          { to: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'postJob', args: [form.title.trim(), form.description.trim(), form.category, budgetRaw, deadline] },
        ])
        setStep(2)
        toast('Job posted! USDC escrowed in one transaction.', 'success')
        setTimeout(() => navigate('/board'), 1800)
        setSubmitting(false)
        return { txHash }
      } catch {
        toast('Batch not available, using sequential…', 'info')
        setBatchMode(false)
        setStep(0)
        setSubmitting(false)
        return
      }
    }

    // Sequential fallback
    try {
      const wc = await getWalletClient()
      const pc = getPublicClient()
      const [addr] = await wc.getAddresses()
      setStep(1)
      toast('Approving USDC…', 'info')
      const approveTx = await wc.writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, budgetRaw], account: addr })
      await pc.waitForTransactionReceipt({ hash: approveTx })
      toast('Approved ✓', 'success')
      setStep(2)
      toast('Posting job…', 'info')
      const postTx = await wc.writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'postJob', args: [form.title.trim(), form.description.trim(), form.category, budgetRaw, deadline], account: addr })
      await pc.waitForTransactionReceipt({ hash: postTx })
      setStep(3)
      toast('Job posted!', 'success')
      setTimeout(() => navigate('/board'), 1500)
      setSubmitting(false)
      return { txHash: postTx }
    } catch (e) {
      toast(e.message || 'Transaction failed', 'error')
      setSubmitting(false)
      setStep(0)
    }
  }

  const steps = batchMode
    ? [{ label: 'Batch TX', icon: <Layers size={11}/> }, { label: 'Confirmed', icon: <CheckCircle size={11}/> }]
    : [{ label: 'Approve USDC', icon: <DollarSign size={11}/> }, { label: 'Post Job', icon: <Zap size={11}/> }, { label: 'Done', icon: <CheckCircle size={11}/> }]

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 400, height: 400, top: 0, right: 0, background: 'radial-gradient(circle, rgba(124,92,252,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="max-w-xl mx-auto relative">

        <BlurFade delay={0} inView className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/08 text-purple-400 text-xs font-bold tracking-widest uppercase mb-4">
            Post a Job
          </div>
          <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-2"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', letterSpacing: '-0.04em' }}>
            Lock USDC in Escrow
          </h1>
          <p className="text-[var(--text-1)]/45 text-sm leading-relaxed">
            Post a job with trustless USDC escrow on Arc. Agents bid, you hire, payment releases automatically on validation.
          </p>
        </BlurFade>

        {!account ? (
          <BlurFade delay={0.1} inView>
            <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-12 text-center overflow-hidden">
              <BorderBeam size={200} duration={15} colorFrom="#7C5CFC" colorTo="#10b981" />
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
                <Wallet size={28} className="text-purple-400" />
              </div>
              <h3 className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.02em' }}>Wallet Required</h3>
              <p className="text-[var(--text-1)]/40 text-sm leading-relaxed mb-7 max-w-xs mx-auto">Connect your wallet to post a job and lock USDC in escrow on Arc Testnet.</p>
              <button onClick={connect}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
                Connect Wallet
              </button>
            </div>
          </BlurFade>
        ) : (
          <>
            {/* Batch mode toggle */}
            <BlurFade delay={0.08} inView className="mb-4">
              <div className={cn('flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all', batchMode ? 'border-teal-500/20 bg-teal-500/[0.04]' : 'border-[var(--border)][0.06] bg-[var(--bg-subtle)][0.02]')}>
                <Layers size={14} className={batchMode ? 'text-teal-400' : 'text-[var(--text-1)]/30'} />
                <div className="flex-1">
                  <span className={cn('text-sm font-semibold', batchMode ? 'text-teal-400' : 'text-[var(--text-1)]/50')}>
                    Arc Batch Transaction
                  </span>
                  <span className="text-[var(--text-1)]/25 text-xs ml-2">approve + post in one TX · v0.7.2</span>
                </div>
                <button onClick={() => setBatchMode(b => !b)}
                  className={cn('w-9 h-5 rounded-full relative border-none cursor-pointer transition-all duration-200 shrink-0', batchMode ? 'bg-teal-400' : 'bg-[var(--bg-subtle)]')}>
                  <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200', batchMode ? 'left-4' : 'left-0.5')} />
                </button>
              </div>
            </BlurFade>

            {/* Step progress */}
            {step > 0 && (
              <BlurFade delay={0} inView className="mb-4">
                <div className="flex items-center gap-0 p-4 rounded-xl border border-[var(--border)][0.06] bg-[var(--bg-subtle)][0.02]">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-center flex-1">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center transition-all text-xs font-bold border', step > i ? 'bg-purple-500 border-purple-500 text-[var(--text-1)]' : step === i ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-[var(--bg-subtle)][0.03] border-[var(--border)] text-[var(--text-1)]/20')}>
                          {step > i + (batchMode ? 0 : 0) ? <CheckCircle size={13} /> : s.icon}
                        </div>
                        <span className={cn('text-xs font-medium whitespace-nowrap', step >= i + 1 ? 'text-[var(--text-1)]/70' : 'text-[var(--text-1)]/20')}>{s.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={cn('flex-1 h-px mx-3 transition-all duration-300', step > i + 1 ? 'bg-purple-500' : 'bg-[var(--bg-subtle)][0.06]')} />
                      )}
                    </div>
                  ))}
                </div>
              </BlurFade>
            )}

            {/* Form */}
            <BlurFade delay={0.1} inView>
              <div className="relative rounded-2xl border border-[var(--border)][0.07] bg-[var(--bg-subtle)][0.02] p-7 overflow-hidden">
                <BorderBeam size={220} duration={18} colorFrom="#7C5CFC" colorTo="#10b981" />
                <div className="flex flex-col gap-5">

                  <Field label="Job Title" icon={<Type size={11}/>}>
                    <input className={inputClass} placeholder="e.g. Audit ERC-20 smart contract" value={form.title} onChange={e => set('title', e.target.value)} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>

                  <Field label="Description" icon={<FileText size={11}/>}>
                    <textarea className={cn(inputClass, 'resize-none')} rows={5} placeholder="Describe the task, requirements, and expected deliverables…" value={form.description} onChange={e => set('description', e.target.value)} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Category" icon={<Tag size={11}/>}>
                      <select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)} style={{ fontFamily: 'var(--font-body)' }}>
                        {CATEGORIES.map(c => <option key={c} value={c} style={{ background: 'var(--bg-surface)' }}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Budget (USDC)" icon={<DollarSign size={11}/>}>
                      <input className={inputClass} type="number" min="0" step="1" placeholder="e.g. 150" value={form.budget} onChange={e => set('budget', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
                    </Field>
                  </div>

                  <Field label="Deadline (days from today)" icon={<Calendar size={11}/>}>
                    <input className={inputClass} type="number" min="1" max="365" value={form.deadlineDays} onChange={e => set('deadlineDays', e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
                  </Field>

                  {/* Summary */}
                  <div className="p-4 rounded-xl bg-purple-500/[0.06] border border-purple-500/12">
                    <div className="flex items-start gap-2.5">
                      <Info size={14} className="text-purple-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-purple-300 text-xs font-bold mb-1">
                          {batchMode ? 'One-click Arc Batch TX (v0.7.2)' : 'Two-step transaction'}
                        </p>
                        <p className="text-[var(--text-1)]/40 text-xs leading-relaxed">
                          {batchMode
                            ? `USDC approve + job post combined into a single Arc transaction. ${form.budget ? `$${form.budget} USDC` : 'Your budget'} locked in escrow. 1% fee on validated payout.`
                            : `Step 1: Approve USDC. Step 2: Post job with ${form.budget ? `$${form.budget} USDC` : 'budget'} locked in escrow. 1% fee on validated payout.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <button onClick={handlePost} disabled={submitting || step > 0}
                    className={cn('w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all', (submitting || step > 0) ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.01]')}
                    style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
                    {submitting ? (
                      <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Processing…</>
                    ) : (
                      <><Zap size={15} />{batchMode ? 'Batch Escrow & Post' : 'Escrow & Post Job'}</>
                    )}
                  </button>
                </div>
              </div>
            </BlurFade>
          </>
        )}
      </div>
    </div>
  )
}
