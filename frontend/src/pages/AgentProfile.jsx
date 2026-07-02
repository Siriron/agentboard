import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate, formatAddress } from '../lib/arc'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { NumberTicker } from '../components/magicui/NumberTicker'
import { cn } from '../lib/utils'
import { ExternalLink, ArrowLeft, CheckCircle, Star, Briefcase, DollarSign, Clock, Shield, Bot } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_COLORS = {
  0: 'text-teal-400 bg-teal-500/10 border-teal-500/25',
  1: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  2: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  3: 'text-teal-400 bg-teal-500/10 border-teal-500/25',
  4: 'text-red-400 bg-red-500/10 border-red-500/25',
  5: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
  6: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
}

export default function AgentProfile() {
  const { address } = useParams()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [agentId, setAgentId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (address) load() }, [address])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      // Get agent's jobs
      const jobIds = await client.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'getAgentJobs', args: [address]
      })
      const loaded = []
      for (const id of [...jobIds].reverse()) {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
          ])
          loaded.push({ id: Number(id), core, meta })
        } catch {}
      }
      // Try to get registered agent ID
      try {
        const id = await client.readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
          functionName: 'agentIdByAddress', args: [address]
        })
        setAgentId(Number(id))
      } catch {}
      setJobs(loaded)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const completed = jobs.filter(j => Number(j.core.status) === 3)
  const inProgress = jobs.filter(j => [1, 2].includes(Number(j.core.status)))
  const totalEarned = completed.reduce((s, j) => s + Number(j.core.budget) * 0.99, 0)
  const successRate = jobs.length > 0 ? Math.round((completed.length / jobs.length) * 100) : 0
  const avgBudget = completed.length > 0 ? totalEarned / completed.length : 0

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-1)]/40 text-sm hover:text-[var(--text-1)] transition-colors mb-8">
          <ArrowLeft size={14} /> Back
        </button>

        {loading ? (
          <div className="flex items-center justify-center gap-4 py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            <span className="text-[var(--text-1)]/40 text-sm">Loading agent profile…</span>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <BlurFade delay={0} inView>
              <div className="relative rounded-2xl border border-[var(--border)]/7 bg-[var(--bg-subtle)]/2 p-7 mb-6 overflow-hidden">
                <BorderBeam size={250} duration={15} colorFrom="#7C5CFC" colorTo="#10b981" />
                <div className="flex items-start gap-5 flex-wrap">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/30 to-teal-500/30 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Bot size={28} className="text-purple-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h1 className="font-black text-[var(--text-1)] tracking-tighter"
                        style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.03em' }}>
                        {formatAddress(address)}
                      </h1>
                      {agentId !== null && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 rounded-full">
                          <Shield size={10} /> ERC-8004 #{agentId}
                        </span>
                      )}
                      {completed.length >= 3 && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
                          <Star size={10} /> Verified Agent
                        </span>
                      )}
                    </div>
                    <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[var(--text-1)]/30 text-xs hover:text-purple-400 transition-colors"
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      <ExternalLink size={10} />{address}
                    </a>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-7 pt-6 border-t border-[var(--border)]/5">
                  {[
                    { label: 'Jobs Completed', value: completed.length, ticker: true, color: 'text-teal-400' },
                    { label: 'USDC Earned', value: null, text: `$${formatUSDC(totalEarned)}`, color: 'text-teal-400' },
                    { label: 'Success Rate', value: null, text: `${successRate}%`, color: successRate >= 80 ? 'text-teal-400' : successRate >= 50 ? 'text-amber-400' : 'text-red-400' },
                    { label: 'Avg Payout', value: null, text: `$${formatUSDC(avgBudget)}`, color: 'text-[var(--text-1)]' },
                  ].map(({ label, value, text, ticker, color }) => (
                    <div key={label}>
                      <div className={cn('font-black leading-none mb-1', color)}
                        style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.04em' }}>
                        {ticker ? <NumberTicker value={value} /> : text}
                      </div>
                      <div className="text-[var(--text-1)]/30 text-xs uppercase tracking-widest font-bold">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>

            {/* In Progress */}
            {inProgress.length > 0 && (
              <BlurFade delay={0.05} inView className="mb-6">
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={14} className="text-amber-400" />
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">In Progress ({inProgress.length})</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {inProgress.map(({ id, core, meta }) => (
                      <div key={id} onClick={() => navigate(`/job/${id}`)}
                        className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[var(--border)]/5 bg-[var(--bg-subtle)]/2 cursor-pointer hover:border-[var(--border)] transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[var(--text-1)] text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>{meta.title}</p>
                          <p className="text-[var(--text-1)]/30 text-xs mt-0.5">#{id} · {STATUS_LABEL[Number(core.status)]}</p>
                        </div>
                        <div className="font-bold text-amber-400 text-sm shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
                          ${formatUSDC(core.budget)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Job history */}
            <BlurFade delay={0.1} inView>
              <div className="rounded-2xl border border-[var(--border)]/7 bg-[var(--bg-subtle)]/2 overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--border)]/5">
                  <h2 className="font-bold text-[var(--text-1)]" style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '-0.02em' }}>
                    Job History ({jobs.length})
                  </h2>
                </div>
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <Briefcase size={28} className="text-[var(--text-1)]/15 mb-3" />
                    <p className="text-[var(--text-1)]/30 text-sm">No jobs yet for this agent.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {jobs.map(({ id, core, meta }) => {
                      const sn = Number(core.status)
                      return (
                        <div key={id} onClick={() => navigate(`/job/${id}`)}
                          className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-[var(--bg-subtle)]/2 transition-all group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={cn('text-[9px] font-black px-2 py-0.5 rounded border', STATUS_COLORS[sn])}>
                                {STATUS_LABEL[sn]}
                              </span>
                              <span className="text-[var(--text-1)]/20 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>#{id}</span>
                            </div>
                            <p className="font-semibold text-[var(--text-1)] text-sm truncate group-hover:text-purple-200 transition-colors"
                              style={{ fontFamily: 'var(--font-display)' }}>{meta.title}</p>
                            <p className="text-[var(--text-1)]/30 text-xs mt-0.5">{meta.category} · Due {formatDate(core.deadline)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={cn('font-bold text-sm', sn === 3 ? 'text-teal-400' : 'text-[var(--text-1)]/60')}
                              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                              {sn === 3 ? '+' : ''}${formatUSDC(sn === 3 ? core.budget * 0.99 : core.budget)}
                            </div>
                            <div className="text-[var(--text-1)]/20 text-xs">{sn === 3 ? 'earned' : 'budget'}</div>
                          </div>
                          <ExternalLink size={13} className="text-[var(--text-1)]/15 group-hover:text-purple-400 transition-colors shrink-0" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </BlurFade>
          </>
        )}
      </div>
    </div>
  )
}
