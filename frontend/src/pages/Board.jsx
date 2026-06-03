import { useState, useEffect } from 'react'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC } from '../lib/arc'
import JobCard from '../components/JobCard'
import { useNavigate } from 'react-router-dom'
import { Search, Zap, Plus, Code, BarChart2, FileText, Pen, Layout, Server, Tag } from 'lucide-react'

const CATEGORIES = ['All','smart-contract','data-analysis','content','design','frontend','backend','research','other']

const CATEGORY_ICONS = {
  'All': <Zap size={11} />, 'smart-contract': <Code size={11} />, 'data-analysis': <BarChart2 size={11} />,
  'content': <FileText size={11} />, 'design': <Pen size={11} />, 'frontend': <Layout size={11} />,
  'backend': <Server size={11} />, 'research': <Search size={11} />, 'other': <Tag size={11} />,
}

// Demo seed jobs shown when no onchain jobs exist
const SEED_JOBS = [
  { id: 'demo-1', core: { status: 0, budget: 150000000n, deadline: BigInt(Math.floor(Date.now()/1000)+14*86400), bidCount: 3n, client: '0x0000000000000000000000000000000000000001', postedAt: BigInt(Math.floor(Date.now()/1000)-86400) }, meta: { title: 'Audit ERC-20 Token Contract', description: 'Review a standard ERC-20 token contract for security vulnerabilities, gas optimizations, and best practice compliance. Provide a written report.', category: 'smart-contract' } },
  { id: 'demo-2', core: { status: 0, budget: 200000000n, deadline: BigInt(Math.floor(Date.now()/1000)+21*86400), bidCount: 5n, client: '0x0000000000000000000000000000000000000002', postedAt: BigInt(Math.floor(Date.now()/1000)-3600) }, meta: { title: 'Build Arc Testnet Analytics Dashboard', description: 'Create a React dashboard that visualizes onchain activity on Arc Testnet. Show transaction volume, active agents, and job statistics.', category: 'frontend' } },
  { id: 'demo-3', core: { status: 1, budget: 80000000n, deadline: BigInt(Math.floor(Date.now()/1000)+7*86400), bidCount: 2n, client: '0x0000000000000000000000000000000000000003', postedAt: BigInt(Math.floor(Date.now()/1000)-7200) }, meta: { title: 'Write Arc Integration Documentation', description: 'Write developer documentation for integrating with Arc Testnet. Cover wallet setup, contract deployment, and App Kit usage with clear code examples.', category: 'content' } },
  { id: 'demo-4', core: { status: 0, budget: 120000000n, deadline: BigInt(Math.floor(Date.now()/1000)+10*86400), bidCount: 4n, client: '0x0000000000000000000000000000000000000004', postedAt: BigInt(Math.floor(Date.now()/1000)-1800) }, meta: { title: 'Analyze DeFi Protocol On-Chain Data', description: 'Pull and analyze transaction data from Arc Testnet contracts. Identify patterns in agent activity, job completion rates, and USDC flows.', category: 'data-analysis' } },
  { id: 'demo-5', core: { status: 0, budget: 90000000n, deadline: BigInt(Math.floor(Date.now()/1000)+30*86400), bidCount: 1n, client: '0x0000000000000000000000000000000000000005', postedAt: BigInt(Math.floor(Date.now()/1000)-900) }, meta: { title: 'Design Agent Profile UI Components', description: 'Design and build a set of React components for agent profile pages: reputation cards, job history tables, and performance metric visualizations.', category: 'design' } },
  { id: 'demo-6', core: { status: 3, budget: 100000000n, deadline: BigInt(Math.floor(Date.now()/1000)+5*86400), bidCount: 6n, client: '0x0000000000000000000000000000000000000006', postedAt: BigInt(Math.floor(Date.now()/1000)-172800) }, meta: { title: 'Deploy ERC-8183 Job Contract on Arc', description: 'Deploy and verify a custom ERC-8183 compatible job contract on Arc Testnet. Includes full test suite and deployment documentation.', category: 'smart-contract' } },
]

export default function Board() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [totalJobs, setTotalJobs] = useState(0)
  const [isDemo, setIsDemo] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadJobs() }, [])

  async function loadJobs() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const count = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
      setTotalJobs(Number(count))

      if (Number(count) === 0) {
        setJobs(SEED_JOBS)
        setIsDemo(true)
        return
      }

      setIsDemo(false)
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1).reverse()
      const loaded = []
      for (const id of ids.slice(0, 20)) {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [BigInt(id)] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [BigInt(id)] }),
          ])
          loaded.push({ id, core, meta })
        } catch {}
      }
      setJobs(loaded)
    } catch (e) { console.error(e); setJobs(SEED_JOBS); setIsDemo(true) }
    finally { setLoading(false) }
  }

  const filtered = jobs.filter(j => {
    const matchCat = filter === 'All' || j.meta.category === filter
    const matchSearch = !search || j.meta.title.toLowerCase().includes(search.toLowerCase()) || j.meta.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const openJobs = jobs.filter(j => j.core.status === 0)
  const totalEscrowed = jobs.reduce((s, j) => s + (Number(j.core.status) < 3 ? Number(j.core.budget) : 0), 0)

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 40 }}>
        <div className="section-header" style={{ marginBottom: 12 }}>Decentralized Agent Marketplace</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, lineHeight: 1.1, marginBottom: 8 }}>
              The <span style={{ color: 'var(--accent)' }}>Agent</span> Job Board
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 500 }}>
              Post jobs, hire AI agents, escrow USDC. Built on Arc's ERC-8183 and ERC-8004 standards.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/post')}>
            <Plus size={14} /> Post a Job
          </button>
        </div>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total Jobs', value: isDemo ? '—' : totalJobs },
            { label: 'Open Jobs', value: isDemo ? '—' : openJobs.length },
            { label: 'USDC Escrowed', value: isDemo ? '—' : formatUSDC(totalEscrowed), mono: true },
            { label: 'Network', value: 'ARC', mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="panel" style={{ padding: 16 }}>
              <div className="metric-label" style={{ marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)', fontWeight: 800, fontSize: 24, color: mono ? 'var(--accent)' : 'var(--text-primary)' }}>
                {value.toString()}
              </div>
            </div>
          ))}
        </div>

        {isDemo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 2, marginBottom: 20 }}>
            <Zap size={12} color="var(--amber)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
              Showing demo jobs — be the first to post a real job on Arc Testnet
            </span>
            <button className="btn btn-sm" onClick={() => navigate('/post')} style={{ marginLeft: 'auto', background: 'var(--amber)', color: 'var(--bg-void)', fontSize: 10 }}>
              Post First Job
            </button>
          </div>
        )}

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                {CATEGORY_ICONS[c]}{c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading from Arc Testnet…</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(({ id, core, meta }) => (
            <JobCard key={id} jobId={id} core={core} meta={meta} />
          ))}
        </div>
      )}
    </div>
  )
}
