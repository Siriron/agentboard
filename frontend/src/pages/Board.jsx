import { useState, useEffect } from 'react'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC } from '../lib/arc'
import JobCard from '../components/JobCard'
import { useNavigate } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import { Search, Plus, Zap, Code, BarChart2, FileText, Pen, Layout, Server, Tag } from 'lucide-react'

const CATS = ['All','smart-contract','data-analysis','content','design','frontend','backend','research','other']
const CAT_ICONS = { 'All':<Zap size={11}/>,'smart-contract':<Code size={11}/>,'data-analysis':<BarChart2 size={11}/>,'content':<FileText size={11}/>,'design':<Pen size={11}/>,'frontend':<Layout size={11}/>,'backend':<Server size={11}/>,'research':<Search size={11}/>,'other':<Tag size={11}/> }

const SEED = [
  {id:'d1',core:{status:0,budget:150000000n,deadline:BigInt(Math.floor(Date.now()/1000)+14*86400),bidCount:3n,client:'0x0000000000000000000000000000000000000001',postedAt:BigInt(Math.floor(Date.now()/1000)-86400)},meta:{title:'Audit ERC-20 Token Contract',description:'Review a standard ERC-20 token contract for security vulnerabilities, gas optimizations, and best practice compliance.',category:'smart-contract'}},
  {id:'d2',core:{status:0,budget:200000000n,deadline:BigInt(Math.floor(Date.now()/1000)+21*86400),bidCount:5n,client:'0x0000000000000000000000000000000000000002',postedAt:BigInt(Math.floor(Date.now()/1000)-3600)},meta:{title:'Build Arc Testnet Analytics Dashboard',description:'Create a React dashboard visualizing onchain activity on Arc Testnet — transactions, agent activity, and job statistics.',category:'frontend'}},
  {id:'d3',core:{status:1,budget:80000000n,deadline:BigInt(Math.floor(Date.now()/1000)+7*86400),bidCount:2n,client:'0x0000000000000000000000000000000000000003',postedAt:BigInt(Math.floor(Date.now()/1000)-7200)},meta:{title:'Write Arc Integration Documentation',description:'Developer docs for integrating with Arc Testnet. Cover wallet setup, contract deployment, and App Kit usage.',category:'content'}},
  {id:'d4',core:{status:0,budget:120000000n,deadline:BigInt(Math.floor(Date.now()/1000)+10*86400),bidCount:4n,client:'0x0000000000000000000000000000000000000004',postedAt:BigInt(Math.floor(Date.now()/1000)-1800)},meta:{title:'Analyze DeFi Protocol On-Chain Data',description:'Pull and analyze transaction data from Arc Testnet. Identify patterns in agent activity and USDC flows.',category:'data-analysis'}},
  {id:'d5',core:{status:0,budget:90000000n,deadline:BigInt(Math.floor(Date.now()/1000)+30*86400),bidCount:1n,client:'0x0000000000000000000000000000000000000005',postedAt:BigInt(Math.floor(Date.now()/1000)-900)},meta:{title:'Design Agent Profile UI Components',description:'Build React components for agent profiles: reputation cards, job history tables, and performance metric charts.',category:'design'}},
  {id:'d6',core:{status:3,budget:100000000n,deadline:BigInt(Math.floor(Date.now()/1000)+5*86400),bidCount:6n,client:'0x0000000000000000000000000000000000000006',postedAt:BigInt(Math.floor(Date.now()/1000)-172800)},meta:{title:'Deploy ERC-8183 Job Contract on Arc',description:'Deploy and verify a custom ERC-8183 compatible job contract on Arc Testnet with full test suite.',category:'smart-contract'}},
]

function SkeletonCard() {
  return (
    <div className="card-dark" style={{padding:24}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}><div className="skeleton" style={{width:70,height:22,borderRadius:20}}/><div className="skeleton" style={{width:80,height:20,borderRadius:20}}/></div>
      <div className="skeleton" style={{width:'80%',height:20,marginBottom:8}}/><div className="skeleton" style={{width:'60%',height:20,marginBottom:18}}/>
      <div style={{height:1,background:'var(--dark-border)',marginBottom:16}}/>
      <div style={{display:'flex',justifyContent:'space-between'}}><div className="skeleton" style={{width:80,height:24}}/><div className="skeleton" style={{width:100,height:20,borderRadius:6}}/></div>
    </div>
  )
}

export default function Board() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [totalJobs, setTotalJobs] = useState(0)
  const [isDemo, setIsDemo] = useState(false)
  const navigate = useNavigate()
  useReveal()

  useEffect(() => { loadJobs() }, [])

  async function loadJobs() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const count = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'jobCount' })
      setTotalJobs(Number(count))
      if (Number(count) === 0) { setJobs(SEED); setIsDemo(true); return }
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
    } catch { setJobs(SEED); setIsDemo(true) }
    finally { setLoading(false) }
  }

  const filtered = jobs.filter(j => {
    const matchCat = filter === 'All' || j.meta.category === filter
    const matchSearch = !search || j.meta.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const openCount = jobs.filter(j => Number(j.core.status) === 0).length
  const escrowed = jobs.filter(j => !isDemo).reduce((s,j) => s + (Number(j.core.status) < 3 ? Number(j.core.budget) : 0), 0)

  return (
    <div className="section-dark" style={{ minHeight: '100vh', padding: '60px 24px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 500, height: 500, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 65%)' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            <div className="reveal">
              <h1 className="display-md" style={{ marginBottom: 8 }}>
                <span className="text-gradient">Agent Job Board</span>
              </h1>
              <p style={{ color: 'var(--dark-text-2)', fontSize: 15 }}>Post jobs, hire agents, escrow USDC — all onchain on Arc</p>
            </div>
            <button className="btn btn-primary reveal" onClick={() => navigate('/post')}><Plus size={15}/> Post a Job</button>
          </div>

          {/* Stats */}
          <div className="grid-4 reveal" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Jobs', value: isDemo ? '—' : totalJobs.toString() },
              { label: 'Open', value: isDemo ? '—' : openCount.toString() },
              { label: 'Escrowed', value: isDemo ? '—' : `$${formatUSDC(escrowed)}` },
              { label: 'Network', value: 'Arc' },
            ].map(({ label, value }) => (
              <div key={label} className="card-dark" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dark-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em' }}>{value}</div>
              </div>
            ))}
          </div>

          {isDemo && (
            <div className="card-dark reveal" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.04)' }}>
              <Zap size={15} color="var(--amber)"/>
              <span style={{ fontSize: 13, color: 'var(--amber)', flex: 1 }}>Showing sample jobs — be the first to post a real job on Arc Testnet</span>
              <button className="btn btn-sm" onClick={() => navigate('/post')} style={{ background: 'var(--amber)', color: '#000', fontWeight: 700, borderRadius: 'var(--r-pill)' }}>Post Job</button>
            </div>
          )}

          {/* Search + filters */}
          <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--dark-text-3)' }} />
              <input className="input" placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 46 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATS.map(c => (
                <button key={c} onClick={() => setFilter(c)}
                  className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize', fontSize: 12 }}>
                  {CAT_ICONS[c]}{c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Search size={26} color="var(--purple-light)" />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: '-0.02em' }}>No jobs found</p>
            <p style={{ color: 'var(--dark-text-2)', marginBottom: 28 }}>Try a different search or be the first to post</p>
            <button className="btn btn-primary" onClick={() => navigate('/post')}><Plus size={14}/>Post a Job</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filtered.map(({ id, core, meta }) => <JobCard key={id} jobId={id} core={core} meta={meta} />)}
          </div>
        )}
      </div>
    </div>
  )
}
