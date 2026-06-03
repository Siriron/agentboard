import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ArrowRight, AlertCircle } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function Dashboard() {
  const { account, connect } = useWallet()
  const navigate = useNavigate()
  const [clientJobs, setClientJobs] = useState([])
  const [agentJobs, setAgentJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('client')

  useEffect(() => { if (account) load() }, [account])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const [cIds, aIds] = await Promise.all([
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getClientJobs', args: [account] }),
        client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [account] }),
      ])
      async function loadList(ids) {
        const jobs = []
        for (const id of ids) {
          try {
            const [core, meta] = await Promise.all([
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
              client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
            ])
            jobs.push({ id: Number(id), core, meta })
          } catch {}
        }
        return jobs.reverse()
      }
      const [cj, aj] = await Promise.all([loadList(cIds), loadList(aIds)])
      setClientJobs(cj)
      setAgentJobs(aj)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!account) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 16, textAlign: 'center', padding: 24 }}>
      <AlertCircle size={40} color="var(--text-muted)" />
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: 'var(--accent)' }}>Connect to view your dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 360, fontSize: 14 }}>See all jobs you've posted as a client and jobs you've been hired for as an agent.</p>
      <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
    </div>
  )

  const completed = agentJobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s, j) => s + Number(j.core.budget), 0)
  const spent = clientJobs.filter(j => Number(j.core.status) === 3).reduce((s, j) => s + Number(j.core.budget), 0)
  const displayJobs = tab === 'client' ? clientJobs : agentJobs

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(24px, 4vw, 32px)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 6 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Your activity on AgentBoard</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Jobs Posted', value: clientJobs.length },
          { label: 'Jobs Completed', value: completed.length },
          { label: 'USDC Earned', value: `$${formatUSDC(earned)}` },
          { label: 'USDC Spent', value: `$${formatUSDC(spent)}` },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--accent)' }}>{value.toString()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['client', `Client (${clientJobs.length})`], ['agent', `Agent (${agentJobs.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40, justifyContent: 'center' }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading from Arc…</span>
        </div>
      ) : displayJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Briefcase size={32} color="var(--text-muted)" style={{ margin: '0 auto 14px' }} />
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{tab === 'client' ? 'No jobs posted yet' : 'No agent jobs yet'}</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>{tab === 'client' ? 'Post your first job to get started' : 'Browse the board and submit bids'}</p>
          <button className="btn btn-primary" onClick={() => navigate(tab === 'client' ? '/post' : '/board')}>
            {tab === 'client' ? 'Post a Job' : 'Browse Board'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayJobs.map(({ id, core, meta }) => {
            const sn = Number(core.status)
            return (
              <div key={id} className="card" style={{ padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => navigate(`/job/${id}`)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`badge badge-${STATUS_CLASS[sn] || 'cancelled'}`}><span className="badge-dot" />{STATUS_LABEL[sn] || 'UNKNOWN'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{meta.title}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{meta.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>${formatUSDC(core.budget)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(core.deadline)}</span>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
