import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { BlurFade } from '../components/magicui/BlurFade'
import { cn } from '../lib/utils'
import {
  Search, SlidersHorizontal, ChevronRight, Briefcase,
  DollarSign, Clock, Users, Zap, Bot, RefreshCw, AlertCircle
} from 'lucide-react'

const CATEGORIES = ['All','SmartContract','Frontend','Backend','Audit','Research','Design','Data','DevOps','Other']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'budget_high', label: 'Budget ↓' },
  { value: 'budget_low', label: 'Budget ↑' },
  { value: 'most_bids', label: 'Most Bids' },
  { value: 'deadline', label: 'Deadline Soon' },
]
const STATUS_FILTER = [
  { value: 'all', label: 'All' },
  { value: '0', label: 'Open' },
  { value: '1', label: 'Hired' },
  { value: '2', label: 'Submitted' },
  { value: '3', label: 'Validated' },
]
const STATUS_META = {
  0: { text: 'text-[var(--test)]', bg: 'bg-[color-mix(in_srgb,var(--test)_10%,transparent)] border-[color-mix(in_srgb,var(--test)_25%,transparent)]', dot: 'bg-[var(--test)]', label: 'OPEN' },
  1: { text: 'text-[var(--amber)]', bg: 'bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] border-[color-mix(in_srgb,var(--amber)_25%,transparent)]', dot: 'bg-[var(--amber)]', label: 'HIRED' },
  2: { text: 'text-[var(--blue)]', bg: 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] border-[color-mix(in_srgb,var(--blue)_25%,transparent)]', dot: 'bg-[var(--blue)]', label: 'SUBMITTED' },
  3: { text: 'text-[var(--test)]', bg: 'bg-[color-mix(in_srgb,var(--test)_10%,transparent)] border-[color-mix(in_srgb,var(--test)_25%,transparent)]', dot: 'bg-[var(--test)]', label: 'VALIDATED' },
  4: { text: 'text-[var(--red)]', bg: 'bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_25%,transparent)]', dot: 'bg-[var(--red)]', label: 'DISPUTED' },
  5: { text: 'text-[var(--text-3)]', bg: 'bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)] border-[color-mix(in_srgb,var(--text-3)_20%,transparent)]', dot: 'bg-[var(--text-3)]', label: 'CANCELLED' },
  6: { text: 'text-[var(--text-3)]', bg: 'bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)] border-[color-mix(in_srgb,var(--text-3)_20%,transparent)]', dot: 'bg-[var(--text-3)]', label: 'EXPIRED' },
}

function JobCard({ job, onClick }) {
  const { id, core, meta } = job
  const sn = Number(core.status)
  const sm = STATUS_META[sn] || STATUS_META[5]
  const bids = Number(core.bidCount)

  return (
    <div role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }} onClick={onClick} className="group relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 cursor-pointer hover:border-[color-mix(in_srgb,var(--net)_25%,transparent)] hover:bg-[var(--bg-subtle)] transition-all duration-200 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border', sm.text, sm.bg)}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sm.dot)} />{sm.label}
          </span>
          <span className="text-[11px] text-[var(--text-2)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded-full font-medium">{meta.category}</span>
        </div>
        <ChevronRight size={14} className="text-[var(--text-3)] group-hover:text-[var(--net)] transition-colors shrink-0 mt-0.5" />
      </div>
      <h3 className="font-bold text-[var(--text-1)] mb-2 leading-snug group-hover:text-[var(--net)] transition-colors line-clamp-2"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', letterSpacing: '-0.02em' }}>
        {meta.title}
      </h3>
      <p className="text-[var(--text-2)] text-xs leading-relaxed mb-4 line-clamp-2">{meta.description}</p>
      <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <DollarSign size={11} className="text-[var(--test)]" />
            <span className="font-bold text-[var(--text-1)] text-sm" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>${formatUSDC(core.budget)}</span>
            <span className="text-[var(--text-2)] text-[11px]">USDC</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={11} className="text-[var(--text-2)]" />
            <span className="text-[var(--text-2)] text-xs">{bids}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-[var(--text-3)]" />
          <span className="text-[var(--text-2)] text-[11px]">{formatDate(core.deadline)}</span>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex gap-2 mb-3">
        <div className="skeleton h-5 w-14 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-3/4 mb-2 rounded" />
      <div className="skeleton h-3 w-full mb-1 rounded" />
      <div className="skeleton h-3 w-2/3 mb-4 rounded" />
      <div className="flex justify-between pt-3.5 border-t border-[var(--border)]">
        <div className="skeleton h-4 w-20 rounded" />
        <div className="skeleton h-4 w-16 rounded" />
      </div>
    </div>
  )
}

export default function Board() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [failedCount, setFailedCount] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  const loadJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    setFailedCount(0)
    try {
      const client = getPublicClient()
      const count = Number(await client.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount'
      }))
      if (count === 0) { setJobs([]); return }

      const ids = Array.from({ length: count }, (_, i) => count - i)
      const loaded = []
      let failures = 0

      // All 28 readContract calls (14 jobs × getJobCore + getJobMeta)
      // fire together via Promise.allSettled so viem's client-level
      // multicall batching (configured in arc.js) can gather them into
      // a single eth_call instead of 28 separate ones. A prior version
      // of this used a concurrency-5 pLimit gate, which was the right
      // idea when the mitigation was "send fewer simultaneous raw
      // requests" — but it actively worked against batching, since
      // calls only combine into one batch if they land in the same
      // tick, and staggering them across waves defeated that. A
      // per-task failure is still caught individually below so one bad
      // job doesn't take down the rest of the board.
      const tasks = ids.map(id => (async () => {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
          ])
          loaded.push({ id, core, meta })
        } catch (e) {
          failures++
          console.error(`[Board] job #${id} failed to load:`, e)
        }
      })())
      await Promise.allSettled(tasks)

      loaded.sort((a, b) => b.id - a.id)
      setJobs(loaded)
      setFailedCount(failures)
    } catch (e) {
      console.error('[Board] loadJobs failed:', e)
      setError(e.message || 'Failed to load jobs from the network.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase().trim()
    if (q && !j.meta.title.toLowerCase().includes(q) && !j.meta.description.toLowerCase().includes(q) && !j.meta.category.toLowerCase().includes(q)) return false
    if (category !== 'All' && j.meta.category !== category) return false
    if (status !== 'all' && Number(j.core.status) !== parseInt(status)) return false
    const budget = Number(j.core.budget) / 1e6
    if (budgetMin && budget < parseFloat(budgetMin)) return false
    if (budgetMax && budget > parseFloat(budgetMax)) return false
    return true
  }).sort((a, b) => {
    switch (sort) {
      case 'budget_high': return Number(b.core.budget) - Number(a.core.budget)
      case 'budget_low': return Number(a.core.budget) - Number(b.core.budget)
      case 'most_bids': return Number(b.core.bidCount) - Number(a.core.bidCount)
      case 'deadline': return Number(a.core.deadline) - Number(b.core.deadline)
      default: return b.id - a.id
    }
  })

  const openCount = jobs.filter(j => Number(j.core.status) === 0).length
  const hasActiveFilters = search || category !== 'All' || status !== 'all' || budgetMin || budgetMax

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] px-5 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <BlurFade delay={0} inView className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--test)] animate-pulse" />
                <span className="text-[var(--test)] text-xs font-bold uppercase tracking-widest">
                  {openCount} open · {jobs.length} total
                </span>
              </div>
              <h1 className="font-black text-[var(--text-1)] tracking-tighter"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,5vw,40px)', letterSpacing: '-0.04em' }}>
                Job Board
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => loadJobs(true)} disabled={refreshing || loading}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] text-xs font-medium hover:text-[var(--text-1)] transition-all', (refreshing || loading) && 'opacity-40 pointer-events-none')}>
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => navigate('/post')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs text-[var(--text-1)] transition-all hover:scale-[1.02] cta"
>
                <Zap size={12} /> Post Job
              </button>
            </div>
          </div>
        </BlurFade>

        {/* Controls */}
        <BlurFade delay={0.04} inView className="mb-5 flex flex-col gap-3">
          {/* Row 1: search + status + sort + filter toggle */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)] pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-1)] placeholder-white/25 text-sm outline-none focus:border-[color-mix(in_srgb,var(--net)_40%,transparent)] focus:bg-[var(--bg-subtle)] transition-all"
                style={{ fontFamily: 'var(--font-body)' }} />
            </div>
            {[
              { value: status, onChange: setStatus, options: STATUS_FILTER },
              { value: sort, onChange: setSort, options: SORT_OPTIONS },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-1)] text-xs outline-none focus:border-[color-mix(in_srgb,var(--net)_40%,transparent)] cursor-pointer"
                style={{ fontFamily: 'var(--font-body)' }}>
                {sel.options.map(o => <option key={o.value} value={o.value} style={{ background: 'var(--bg-surface)' }}>{o.label}</option>)}
              </select>
            ))}
            <button onClick={() => setShowFilters(f => !f)}
              className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all', showFilters ? 'border-[color-mix(in_srgb,var(--net)_35%,transparent)] bg-[color-mix(in_srgb,var(--net)_10%,transparent)] text-[var(--net)]' : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-2)] hover:text-[var(--text-1)]')}>
              <SlidersHorizontal size={12} /> Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[var(--net)] ml-0.5" />}
            </button>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="flex gap-3 flex-wrap items-end p-4 rounded-xl border border-[color-mix(in_srgb,var(--net)_12%,transparent)] bg-[var(--net)]/[0.03]">
              {[
                { label: 'Min Budget (USDC)', value: budgetMin, set: setBudgetMin, ph: '0' },
                { label: 'Max Budget (USDC)', value: budgetMax, set: setBudgetMax, ph: '∞' },
              ].map(({ label, value, set, ph }) => (
                <div key={label}>
                  <div className="text-[var(--text-2)] text-[11px] font-bold uppercase tracking-wide mb-1.5">{label}</div>
                  <input value={value} onChange={e => set(e.target.value)} type="number" placeholder={ph}
                    className="w-28 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-1)] text-xs outline-none focus:border-[color-mix(in_srgb,var(--net)_40%,transparent)]"
                    style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
              ))}
              {hasActiveFilters && (
                <button onClick={() => { setBudgetMin(''); setBudgetMax(''); setSearch(''); setCategory('All'); setStatus('all') }}
                  className="px-3 py-2 rounded-lg text-[var(--text-2)] text-xs hover:text-[var(--text-1)] transition-colors border border-[var(--border)]">
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all', category === cat
                  ? 'bg-[color-mix(in_srgb,var(--net)_15%,transparent)] border-[color-mix(in_srgb,var(--net)_35%,transparent)] text-[var(--net)]'
                  : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-2)] hover:border-[var(--border)]')}>
                {cat}
              </button>
            ))}
          </div>
        </BlurFade>

        {/* Result count */}
        {!loading && !error && (
          <div className="flex items-center gap-2 text-[var(--text-2)] text-xs mb-4">
            <span>
              {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
              {hasActiveFilters ? ' matching filters' : ''}
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-[color-mix(in_srgb,var(--amber)_70%,transparent)]">
                <AlertCircle size={11} />
                {failedCount} {failedCount === 1 ? 'job' : 'jobs'} failed to load — try refresh
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border border-[color-mix(in_srgb,var(--red)_20%,transparent)] flex items-center justify-center mb-4">
              <AlertCircle size={24} className="text-[var(--red)]" />
            </div>
            <p className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)' }}>
              Couldn't load the job board
            </p>
            <p className="text-[var(--text-2)] text-sm mb-6 max-w-sm">{error}</p>
            <button onClick={() => loadJobs()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[color-mix(in_srgb,var(--red)_25%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-[var(--red)] text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--red)_15%,transparent)] transition-all">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[color-mix(in_srgb,var(--net)_10%,transparent)] border border-[color-mix(in_srgb,var(--net)_15%,transparent)] flex items-center justify-center mb-4">
              <Briefcase size={24} className="text-[var(--net)]" />
            </div>
            <p className="font-bold text-[var(--text-1)] mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)' }}>
              {search ? `No results for "${search}"` : 'No jobs found'}
            </p>
            <p className="text-[var(--text-2)] text-sm mb-6">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Be the first to post a job.'}
            </p>
            {hasActiveFilters && (
              <button onClick={() => { setSearch(''); setCategory('All'); setStatus('all'); setBudgetMin(''); setBudgetMax('') }}
                className="text-[var(--net)] text-sm hover:text-[var(--net)] transition-colors underline underline-offset-2">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(job => (
              <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
            ))}
          </div>
        )}

        {/* Headless agent CTA */}
        {!loading && filtered.length > 0 && (
          <BlurFade delay={0} inView className="mt-10">
            <div className="relative rounded-2xl border border-[color-mix(in_srgb,var(--net)_12%,transparent)] bg-[var(--net)]/[0.03] p-5 flex items-center justify-between gap-5 flex-wrap overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--net)_12%,transparent)] flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-[var(--net)]" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-1)] text-sm" style={{ fontFamily: 'var(--font-display)' }}>Building an AI agent?</p>
                  <p className="text-[var(--text-2)] text-xs">Bid headlessly with Circle Dev-Controlled Wallets — no MetaMask required.</p>
                </div>
              </div>
              <button onClick={() => navigate('/docs#headless')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[color-mix(in_srgb,var(--net)_25%,transparent)] bg-[color-mix(in_srgb,var(--net)_8%,transparent)] text-[var(--net)] text-xs font-semibold hover:bg-[color-mix(in_srgb,var(--net)_15%,transparent)] transition-all shrink-0"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                View API Docs <ChevronRight size={12} />
              </button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  )
}
