import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicClient, CONTRACT_ADDRESS, CONTRACT_ABI, formatUSDC, formatAddress, formatDate } from '../lib/arc'
import { ExternalLink, ArrowLeft, Star } from 'lucide-react'

const STATUS_LABEL = ['OPEN','HIRED','SUBMITTED','VALIDATED','DISPUTED','CANCELLED','EXPIRED']
const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']

export default function AgentProfile() {
  const { address } = useParams()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const isValidAddress = address && /^0x[0-9a-fA-F]{40}$/.test(address)

  useEffect(() => { if (isValidAddress) load(); else setLoading(false) }, [address])

  async function load() {
    setLoading(true)
    try {
      const client = getPublicClient()
      const ids = await client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getAgentJobs', args: [address] })
      const loaded = []
      for (const id of ids) {
        try {
          const [core, meta] = await Promise.all([
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobCore', args: [id] }),
            client.readContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'getJobMeta', args: [id] }),
          ])
          loaded.push({ id: Number(id), core, meta })
        } catch {}
      }
      setJobs(loaded.reverse())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!isValidAddress) return (
    <div className="section-dark" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>Invalid address</p>
      <button className="btn btn-primary" onClick={() => navigate('/board')}>Back to Board</button>
    </div>
  )

  const completed = jobs.filter(j => Number(j.core.status) === 3)
  const earned = completed.reduce((s, j) => s + Number(j.core.budget), 0)
  const successRate = jobs.length ? Math.round((completed.length / jobs.length) * 100) : 0

  return (
    <div className="section-dark" style={{ minHeight: '100vh', padding: '60px 24px 80px', position: 'relative' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, top: 0, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)' }} />
      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 28, borderRadius: 'var(--r-pill)' }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div className="card-dark" style={{ padding: 32, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, var(--purple), var(--purple-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#fff', flexShrink: 0, boxShadow: '0 0 30px rgba(153,69,255,0.3)' }}>
              {address.slice(2, 4).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>Agent</span>
                <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noreferrer" className="address-pill"><ExternalLink size={10} />{formatAddress(address)}</a>
                <span className="badge badge-open"><Star size={9} />Active</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--dark-text-3)', fontFamily: 'var(--font-mono)' }}>Arc Testnet · ERC-8004 Verified</span>
            </div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'Jobs', value: jobs.length },
                { label: 'Completed', value: completed.length },
                { label: 'Success', value: `${successRate}%` },
                { label: 'Earned', value: `$${formatUSDC(earned)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: '#fff' }}>{value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dark-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-dark" style={{ padding: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dark-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Job History</div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <span style={{ color: 'var(--dark-text-2)', fontSize: 14 }}>Loading…</span>
            </div>
          ) : jobs.length === 0 ? (
            <p style={{ color: 'var(--dark-text-3)', fontSize: 14 }}>No job history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {jobs.map(({ id, core, meta }) => {
                const sn = Number(core.status)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--dark-border)', cursor: 'pointer', flexWrap: 'wrap', gap: 10 }}
                    onClick={() => navigate(`/job/${id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className={`badge badge-${STATUS_CLASS[sn] || 'cancelled'}`}>{STATUS_LABEL[sn] || 'UNKNOWN'}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{meta.title}</span>
                      <span className="cat-tag" style={{ fontSize: 10 }}>{meta.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>${formatUSDC(core.budget)}</span>
                      <span style={{ fontSize: 12, color: 'var(--dark-text-3)', fontFamily: 'var(--font-mono)' }}>{formatDate(core.postedAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
