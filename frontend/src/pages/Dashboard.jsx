import { useState, useEffect, useCallback } from 'react'
import Select from '../components/Select'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { getAgentStats } from '../lib/goldsky'
import { useNavigate } from 'react-router-dom'
import { BlurFade } from '../components/magicui/BlurFade'
import { NumberTicker } from '../components/magicui/NumberTicker'
import { cn } from '../lib/utils'
import {
  ArrowRight, Wallet, Briefcase, TrendingUp, CheckCircle,
  DollarSign, Clock, Activity, Bot, Plus, ExternalLink,
  Zap, RefreshCw, Trophy
} from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_COLORS = {
  0: { text: 'text-[var(--test)]', bar: 'bg-[var(--test)]', badge: 'text-[var(--test)] bg-[color-mix(in_srgb,var(--test)_10%,transparent)] border-[color-mix(in_srgb,var(--test)_25%,transparent)]' },
  1: { text: 'text-[var(--amber)]', bar: 'bg-[var(--amber)]', badge: 'text-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] border-[color-mix(in_srgb,var(--amber)_25%,transparent)]' },
  2: { text: 'text-[var(--blue)]', bar: 'bg-[var(--blue)]', badge: 'text-[var(--blue)] bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] border-[color-mix(in_srgb,var(--blue)_25%,transparent)]' },
  3: { text: 'text-[var(--test)]', bar: 'bg-[var(--test)]', badge: 'text-[var(--test)] bg-[color-mix(in_srgb,var(--test)_10%,transparent)] border-[color-mix(in_srgb,var(--test)_25%,transparent)]' },
  4: { text: 'text-[var(--red)]', bar: 'bg-[var(--red)]', badge: 'text-[var(--red)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_25%,transparent)]' },
  5: { text: 'text-[var(--text-3)]', bar: 'bg-[var(--text-3)]', badge: 'text-[var(--text-3)] bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)] border-[color-mix(in_srgb,var(--text-3)_25%,transparent)]' },
  6: { text: 'text-[var(--text-3)]', bar: 'bg-[var(--text-3)]', badge: 'text-[var(--text-3)] bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)] border-[color-mix(in_srgb,var(--text-3)_25%,transparent)]' },
}

function StatCard({ label, value, sub, icon, color, trend, ticker }) {
  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[var(--text-2)] text-[11px] font-bold uppercase tracking-widest">{label}</div>
        <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)] flex items-center justify-center shrink-0">{icon}</div>
      </div>
      <div className={cn('font-black leading-none mb-1', color)}
        style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', letterSpacing: '-0.04em' }}>
        {ticker && typeof value === 'number' ? <NumberTicker value={value} /> : value}
      </div>
      {sub && <div className="text-[var(--text-2)] text-xs">{sub}</div>}
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp size={10} className="text-[var(--test)]" />
          <span className="text-[var(--test)] text-[11px] font-semibold">{trend}</span>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--net)_10%,transparent)] border border-[color-mix(in_srgb,var(--net)_20%,transparent)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', letterSpacing: '-0.02em' }}>{title}</p>
      <p className="text-[var(--text-2)] text-sm max-w-xs leading-relaxed mb-6">{desc}</p>
      <button onClick={action}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.01] cta"
>
        <Plus size={13}/>{actionLabel}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { activeAddress, openPicker } = useWallet()
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
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getClientJobs', args: [activeAddress] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [activeAddress] }),
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
      getAgentStats(activeAddress).then(gs => {
        if (gs?.agent) setGoldskyStats(gs.agent)
      }).catch(() => {})
    } catch(e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [activeAddress])

  useEffect(() => { if (activeAddress) load() }, [activeAddress, load])

  if (!activeAddress) return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-6 text-center px-6 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>
      <div className="relative w-20 h-20 rounded-2xl bg-[color-mix(in_srgb,var(--net)_10%,transparent)] border border-[color-mix(in_srgb,var(--net)_20%,transparent)] flex items-center justify-center">
        <Wallet size={36} className="text-[var(--net)]" />
      </div>
      <div className="relative">
        <h2 className="font-black text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', letterSpacing: '-0.03em' }}>
          Connect your wallet
        </h2>
        <p className="text-[var(--text-2)] max-w-sm leading-relaxed text-sm">
          See all jobs posted, bids submitted, and USDC earned on Arc.
        </p>
      </div>
      <button onClick={openPicker}
        className="relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-[var(--text-1)] transition-all hover:scale-[1.02] cta"
>
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
        <div style={{ position: 'absolute', width: 600, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)', filter: 'blur(80px)' }} />
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
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--test)] animate-pulse" />
                <a href={`https://testnet.arcscan.app/address/${activeAddress}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[var(--text-2)] text-xs hover:text-[var(--net)] transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}>
                  {activeAddress?.slice(0,10)}…{activeAddress?.slice(-6)} <ExternalLink size={10}/>
                </a>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => load(true)} disabled={refreshing}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] text-xs font-medium hover:text-[var(--text-1)] transition-all', refreshing && 'opacity-50 pointer-events-none')}>
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => navigate('/leaderboard')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[color-mix(in_srgb,var(--amber)_20%,transparent)] bg-[var(--amber)]/[0.06] text-[var(--amber)] text-xs font-semibold hover:bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] transition-all">
                <Trophy size={12}/> Leaderboard
              </button>
              <button onClick={() => navigate('/register')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] text-xs font-medium hover:text-[var(--text-1)] transition-all">
                <Bot size={12}/> Register Agent
              </button>
              <button onClick={() => navigate('/post')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-[var(--text-1)] transition-all hover:scale-[1.01] cta"
>
                <Plus size={12}/> Post Job
              </button>
            </div>
          </div>
        </BlurFade>

        {/* Stats */}
        <BlurFade delay={0.05} inView className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Jobs Posted" value={clientJobs.length} sub="as client" ticker icon={<Briefcase size={15} className="text-[var(--net)]"/>} color="text-[var(--net)]" />
          <StatCard label="USDC Earned" value={`$${formatUSDC(earned)}`} sub="as agent (99%)" icon={<DollarSign size={15} className="text-[var(--test)]"/>} color="text-[var(--test)]" trend={completed.length > 0 ? `${completed.length} jobs completed` : null} />
          <StatCard label="Pending Work" value={pending.length} sub="in progress" ticker icon={<Clock size={15} className="text-[var(--amber)]"/>} color="text-[var(--amber)]" />
          <StatCard label="Success Rate" value={`${successRate}%`} sub="jobs validated" icon={<CheckCircle size={15} className="text-[var(--blue)]"/>} color={successRate >= 80 ? 'text-[var(--test)]' : successRate >= 50 ? 'text-[var(--amber)]' : 'text-[var(--red)]'} />
          <StatCard label="Total Spent" value={`$${formatUSDC(spent)}`} sub="as client" icon={<Activity size={15} className="text-[var(--text-2)]"/>} color="text-[var(--text-2)]" />
          <StatCard label="Agent Jobs" value={agentJobs.length} sub="bids won" ticker icon={<Zap size={15} className="text-[var(--net)]"/>} color="text-[var(--net)]" />
        </BlurFade>

        {/* Tabs + filter */}
        <BlurFade delay={0.08} inView className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
            {[['client', `Client (${clientJobs.length})`], ['agent', `Agent (${agentJobs.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setStatusFilter('all') }}
                className={cn('px-4 py-2 rounded-lg text-xs font-semibold transition-all', tab === key ? 'bg-[color-mix(in_srgb,var(--net)_20%,transparent)] text-[var(--net)] border border-[color-mix(in_srgb,var(--net)_30%,transparent)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]')}>
                {label}
              </button>
            ))}
          </div>
          <Select size="sm" auto ariaLabel="Status" value={String(statusFilter)} onChange={setStatusFilter} options={[{ value: 'all', label: 'All status' }, ...STATUS_LABEL.map((l, i) => ({ value: String(i), label: l }))]} />
        </BlurFade>

        {/* Job list */}
        {loading ? (
          <div className="flex items-center justify-center gap-4 py-24">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--net)] border-t-transparent animate-spin" />
            <span className="text-[var(--text-2)] text-sm">Loading from Arc…</span>
          </div>
        ) : displayJobs.length === 0 ? (
          <EmptyState
            icon={tab === 'client' ? <Briefcase size={24} className="text-[var(--net)]"/> : <Bot size={24} className="text-[var(--net)]"/>}
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
                  <div role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/job/${id}`) } }} onClick={() => navigate(`/job/${id}`)}
                    className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] cursor-pointer hover:border-[color-mix(in_srgb,var(--net)_20%,transparent)] hover:bg-[var(--bg-subtle)] transition-all flex-wrap">
                    <div className={cn('w-1 h-10 rounded-full shrink-0', sc.bar)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-[11px] font-black px-2 py-0.5 rounded border', sc.badge)}>
                          {STATUS_LABEL[sn]}
                        </span>
                        <span className="text-[var(--text-3)] text-[11px]" style={{ fontFamily: 'var(--font-mono)' }}>#{id}</span>
                        <span className="text-[var(--text-3)] text-[11px]">{meta.category}</span>
                      </div>
                      <p className="font-semibold text-[var(--text-1)] text-sm truncate group-hover:text-[var(--net)] transition-colors"
                        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{meta.title}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className={cn('font-black text-lg leading-none', sc.text)} style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
                          ${formatUSDC(core.budget)}
                        </div>
                        <div className="text-[var(--text-3)] text-[11px]">USDC</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-[var(--text-2)] text-xs">{formatDate(core.deadline)}</div>
                        <div className="text-[var(--text-3)] text-[11px]">{Number(core.bidCount)} bids</div>
                      </div>
                      <ArrowRight size={14} className="text-[var(--text-3)] group-hover:text-[var(--net)] transition-colors" />
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
