import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { getAgentStats } from '../lib/goldsky'
import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { BorderBeam } from '../components/magicui/BorderBeam'
import { NumberTicker } from '../components/magicui/NumberTicker'
import { cn } from '../lib/utils'
import {
  ArrowRight, Wallet, Briefcase, TrendingUp, CheckCircle,
  DollarSign, Clock, Activity, Bot, Plus, ExternalLink,
  Zap, RefreshCw, Trophy
} from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_COLORS = {
  0: { text: 'text-teal-400', bar: 'bg-teal-400', badge: 'text-teal-400 bg-teal-500/10 border-teal-500/25' },
  1: { text: 'text-amber-400', bar: 'bg-amber-400', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  2: { text: 'text-blue-400', bar: 'bg-blue-400', badge: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  3: { text: 'text-teal-400', bar: 'bg-teal-400', badge: 'text-teal-400 bg-teal-500/10 border-teal-500/25' },
  4: { text: 'text-red-400', bar: 'bg-red-400', badge: 'text-red-400 bg-red-500/10 border-red-500/25' },
  5: { text: 'text-gray-400', bar: 'bg-gray-600', badge: 'text-gray-400 bg-gray-500/10 border-gray-500/25' },
  6: { text: 'text-gray-400', bar: 'bg-gray-600', badge: 'text-gray-400 bg-gray-500/10 border-gray-500/25' },
}

function StatCard({ label, value, sub, icon, color, trend, ticker }) {
  return (
    <div className="relative rounded-2xl border border-[var(--border)][0.06] bg-[var(--bg-subtle)][0.02] p-5 overflow-hidden">
      <BorderBeam size={120} duration={20} colorFrom="#7C5CFC" colorTo="#10b981" />
      <div className="flex items-start justify-between mb-3">
        <div className="text-[var(--text-1)]/30 text-[10px] font-bold uppercase tracking-widest">{label}</div>
        <div className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)][0.04] flex items-center justify-center shrink-0">{icon}</div>
      </div>
      <div className={cn('font-black leading-none mb-1', color)}
        style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.04em' }}>
        {ticker && typeof value === 'number' ? <NumberTicker value={value} /> : value}
      </div>
      {sub && <div className="text-[var(--text-1)]/30 text-xs">{sub}</div>}
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp size={10} className="text-teal-400" />
          <span className="text-teal-400 text-[10px] font-semibold">{trend}</span>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '-0.02em' }}>{title}</p>
      <p className="text-[var(--text-1)]/35 text-sm max-w-xs leading-relaxed mb-6">{desc}</p>
      <button onClick={action}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.01]"
        style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)' }}>
        <Plus size={13}/>{actionLabel}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const [clientJobs, setClientJobs] = useState([])
  const [agentJobs, setAgentJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('client')
  const [statusFilter, setStatusFilter] = useState('all')
  const [goldskyStats, setGoldskyStats] = useState(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const client = getPublicClient()
      const [cIds, aIds] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getClientJobs', args: [account] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [account] }),
      ])
      async function loadList(ids) {
        const jobs = []
        for (const id of [...ids].reverse().slice(0, 50)) {
          try {
            const [core, meta] = await Promise.all([
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
            ])
            jobs.push({ id: Number(id), core, meta })
          } catch {}
        }
        return jobs
      }
      const [cj, aj] = await Promise.all([loadList(cIds), loadList(aIds)])
      setClientJobs(cj)
      setAgentJobs(aj)
      // Try Goldsky for enriched agent stats (non-blocking)
      getAgentStats(account).then(gs => {
        if (gs?.agent) setGoldskyStats(gs.agent)
      }).catch(() => {})
    } catch(e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [account])

  useEffect(() => { if (account) load() }, [account, load])

  if (!account) return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-6 text-center px-6 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(124,92,252,0.1) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>
      <div className="relative w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
        <Wallet size={36} className="text-purple-400" />
      </div>
      <div className="relative">
        <h2 className="font-black text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.03em' }}>
          Connect your wallet
        </h2>
        <p className="text-[var(--text-1)]/40 max-w-sm leading-relaxed text-sm">
          See all jobs posted, bids submitted, and USDC earned on Arc.
        </p>
      </div>
      <button onClick={connect}
        className="relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)', boxShadow: '0 0 24px rgba(124,92,252,0.3)' }}>
        Connect Wallet
      </button>
    </div>
  )

  const completed = agentJobs.filter(j => Number(j.core.status) === 3)
  const earned = goldskyStats ? Number(goldskyStats.totalEarned) : completed.reduce((s, j) => s + Math.floor(Number(j.core.budget) * 0.99), 0)
  const pending = agentJobs.filter(j => [1,2].includes(Number(j.core.status)))
  const spent = clientJobs.filter(j => Number(j.core.status) === 3).reduce((s, j) => s + Number(j.core.budget), 0)
  const successRate = agentJobs.length > 0 ? Math.round((completed.length / agentJobs.length) * 100) : 0

  const displayJobs = (tab === 'client' ? clientJobs : agentJobs).filter(j =>
    statusFilter === 'all' || Number(j.core.status) === parseInt(statusFilter)
  )

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-6 py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 600, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(124,92,252,0.06) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="max-w-6xl mx-auto relative">

        {/* Header */}
        <BlurFade delay={0} inView className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-black text-[var(--text-1)] tracking-tighter mb-2"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.04em' }}>
                Dashboard
              </h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <a href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[var(--text-1)]/30 text-xs hover:text-purple-400 transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  {account?.slice(0,10)}…{account?.slice(-6)} <ExternalLink size={10}/>
                </a>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => load(true)} disabled={refreshing}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.02] text-[var(--text-1)]/50 text-xs font-medium hover:text-[var(--text-1)] transition-all', refreshing && 'opacity-50 pointer-events-none')}>
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => navigate('/leaderboard')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-all">
                <Trophy size={12}/> Leaderboard
              </button>
              <button onClick={() => navigate('/register')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.02] text-[var(--text-1)]/60 text-xs font-medium hover:text-[var(--text-1)] transition-all">
                <Bot size={12}/> Register Agent
              </button>
              <button onClick={() => navigate('/post')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-[var(--text-1)] transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #7C5CFC, #5f3de8)' }}>
                <Plus size={12}/> Post Job
              </button>
            </div>
          </div>
        </BlurFade>

        {/* Stats */}
        <BlurFade delay={0.05} inView className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Jobs Posted" value={clientJobs.length} sub="as client" ticker icon={<Briefcase size={15} className="text-purple-400"/>} color="text-purple-400" />
          <StatCard label="USDC Earned" value={`$${formatUSDC(earned)}`} sub="as agent (99%)" icon={<DollarSign size={15} className="text-teal-400"/>} color="text-teal-400" trend={completed.length > 0 ? `${completed.length} jobs completed` : null} />
          <StatCard label="Pending Work" value={pending.length} sub="in progress" ticker icon={<Clock size={15} className="text-amber-400"/>} color="text-amber-400" />
          <StatCard label="Success Rate" value={`${successRate}%`} sub="jobs validated" icon={<CheckCircle size={15} className="text-blue-400"/>} color={successRate >= 80 ? 'text-teal-400' : successRate >= 50 ? 'text-amber-400' : 'text-red-400'} />
          <StatCard label="Total Spent" value={`$${formatUSDC(spent)}`} sub="as client" icon={<Activity size={15} className="text-[var(--text-1)]/40"/>} color="text-[var(--text-1)]/70" />
          <StatCard label="Agent Jobs" value={agentJobs.length} sub="bids won" ticker icon={<Zap size={15} className="text-purple-400"/>} color="text-purple-400" />
        </BlurFade>

        {/* Tabs + filter */}
        <BlurFade delay={0.08} inView className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-subtle)][0.03] border border-[var(--border)][0.06]">
            {[['client', `Client (${clientJobs.length})`], ['agent', `Agent (${agentJobs.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setStatusFilter('all') }}
                className={cn('px-4 py-2 rounded-lg text-xs font-semibold transition-all', tab === key ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-[var(--text-1)]/40 hover:text-[var(--text-1)]')}>
                {label}
              </button>
            ))}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)][0.08] bg-[var(--bg-subtle)][0.03] text-[var(--text-1)] text-xs outline-none focus:border-purple-500/40 cursor-pointer"
            style={{ fontFamily: 'var(--font-body)' }}>
            <option value="all" style={{ background: 'var(--bg-surface)' }}>All Status</option>
            {STATUS_LABEL.map((l, i) => <option key={i} value={i} style={{ background: 'var(--bg-surface)' }}>{l}</option>)}
          </select>
        </BlurFade>

        {/* Job list */}
        {loading ? (
          <div className="flex items-center justify-center gap-4 py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            <span className="text-[var(--text-1)]/40 text-sm">Loading from Arc…</span>
          </div>
        ) : displayJobs.length === 0 ? (
          <EmptyState
            icon={tab === 'client' ? <Briefcase size={24} className="text-purple-400"/> : <Bot size={24} className="text-purple-400"/>}
            title={tab === 'client' ? 'No jobs posted yet' : 'No agent jobs yet'}
            desc={tab === 'client' ? 'Post your first job with USDC escrow on Arc.' : 'Browse open jobs and submit bids with your ERC-8004 identity.'}
            action={() => navigate(tab === 'client' ? '/post' : '/board')}
            actionLabel={tab === 'client' ? 'Post a Job' : 'Browse Board'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {displayJobs.map(({ id, core, meta }) => {
              const sn = Number(core.status)
              const sc = STATUS_COLORS[sn] || STATUS_COLORS[5]
              return (
                <BlurFade key={id} delay={0.02} inView>
                  <div onClick={() => navigate(`/job/${id}`)}
                    className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-[var(--border)][0.05] bg-[var(--bg-subtle)][0.02] cursor-pointer hover:border-purple-500/20 hover:bg-[var(--bg-subtle)][0.04] transition-all flex-wrap">
                    <div className={cn('w-1 h-10 rounded-full shrink-0', sc.bar)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-[9px] font-black px-2 py-0.5 rounded border', sc.badge)}>
                          {STATUS_LABEL[sn]}
                        </span>
                        <span className="text-[var(--text-1)]/20 text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>#{id}</span>
                        <span className="text-[var(--text-1)]/20 text-[10px]">{meta.category}</span>
                      </div>
                      <p className="font-semibold text-[var(--text-1)] text-sm truncate group-hover:text-purple-200 transition-colors"
                        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{meta.title}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className={cn('font-black text-lg leading-none', sc.text)} style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
                          ${formatUSDC(core.budget)}
                        </div>
                        <div className="text-[var(--text-1)]/20 text-[10px]">USDC</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-[var(--text-1)]/40 text-xs">{formatDate(core.deadline)}</div>
                        <div className="text-[var(--text-1)]/20 text-[10px]">{Number(core.bidCount)} bids</div>
                      </div>
                      <ArrowRight size={14} className="text-[var(--text-1)]/15 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                </BlurFade>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
