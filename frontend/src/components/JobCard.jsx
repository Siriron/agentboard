import { useNavigate } from 'react-router-dom'
import { formatUSDC, formatAddress, formatDate, STATUS_LABEL } from '../lib/arc'
import { Users, Clock, ExternalLink, Code, BarChart2, FileText, Pen, Layout, Server, Search, Tag } from 'lucide-react'

const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']
const CAT_ICONS = { 'smart-contract':<Code size={11}/>,'data-analysis':<BarChart2 size={11}/>,'content':<FileText size={11}/>,'design':<Pen size={11}/>,'frontend':<Layout size={11}/>,'backend':<Server size={11}/>,'research':<Search size={11}/>,'other':<Tag size={11}/> }

export default function JobCard({ jobId, core, meta }) {
  const navigate = useNavigate()
  const sn = Number(core.status)
  const isDemo = typeof jobId === 'string' && jobId.startsWith('d')

  return (
    <div className="card" onClick={() => !isDemo && navigate(`/job/${jobId}`)} style={{ padding: 24, cursor: isDemo ? 'default' : 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className={`badge badge-${STATUS_CLASS[sn]||'cancelled'}`}><span className="badge-dot" />{STATUS_LABEL[sn]||'OPEN'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'capitalize' }}>{CAT_ICONS[meta.category]||<Tag size={11}/>}{meta.category}</span>
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 8, lineHeight: 1.3, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>{meta.title}</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, marginBottom: 18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{meta.description}</p>
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>${formatUSDC(core.budget)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 3 }}>USDC</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}><Users size={12}/>{core.bidCount.toString()}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}><Clock size={12}/>{formatDate(core.deadline)}</span>
        </div>
        {!isDemo && <a href={`https://testnet.arcscan.app/address/${core.client}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="address-pill" style={{fontSize:10}}><ExternalLink size={9}/>{formatAddress(core.client)}</a>}
      </div>
    </div>
  )
}
