import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatDate } from '../lib/arc'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ArrowRight, Wallet } from 'lucide-react'

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
      setClientJobs(cj); setAgentJobs(aj)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!account) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center', padding: 24 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Wallet size={32} color="var(--indigo)" />
      </div>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', marginBottom: 8 }}>Connect your wallet</h2>
        <p style={{ color: 'var(--text-2)', maxWidth: 340, fontSize: 14, lineHeight: 1.6 }}>See all jobs you've posted and jobs you've been hired for as an agent.</p>
      </div>
      <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
    </div>
  )

  const completed = agentJobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s,j) => s + Number(j.core.budget), 0)
  const spent = clientJobs.filter(j => Number(j.core.status) === 3).reduce((s,j) => s + Number(j.core.budget), 0)
  const displayJobs = tab === 'client' ? clientJobs : agentJobs

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 800, fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.03em', marginBottom: 6 }}>
          <span className="grad-text">Dashboard</span>
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Your activity on AgentBoard</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Jobs Posted', value: clientJobs.length, color: 'var(--text-1)' },
          { label: 'Completed', value: completed.length, color: 'var(--emerald)' },
          { label: 'USDC Earned', value: `$${formatUSDC(earned)}`, color: 'var(--indigo)' },
          { label: 'USDC Spent', value: `$${formatUSDC(spent)}`, color: 'var(--cyan)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color }}>{value.toString()}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['client',`Client (${clientJobs.length})`],['agent',`Agent (${agentJobs.length})`]].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} className={`btn ${tab===key?'btn-primary':'btn-secondary'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60 }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading from Arc…</span>
        </div>
      ) : displayJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--indigo-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Briefcase size={24} color="var(--indigo)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, letterSpacing: '-0.02em' }}>
            {tab==='client' ? 'No jobs posted yet' : 'No agent jobs yet'}
          </p>
          <p style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: 14 }}>
            {tab==='client' ? 'Post your first job to get started' : 'Browse the board and submit bids'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(tab==='client'?'/post':'/board')}>
            {tab==='client' ? 'Post a Job' : 'Browse Board'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayJobs.map(({ id, core, meta }) => {
            const sn = Number(core.status)
            return (
              <div key={id} className="glass-card" style={{ padding: '16px 20px', cursor: 'pointer' }}
                onClick={() => navigate(`/job/${id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`badge badge-${STATUS_CLASS[sn]||'cancelled'}`}><span className="badge-dot" />{STATUS_LABEL[sn]||'UNKNOWN'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{meta.title}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{meta.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>${formatUSDC(core.budget)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(core.deadline)}</span>
                    <ArrowRight size={14} color="var(--text-3)" />
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
