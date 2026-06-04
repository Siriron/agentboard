import { useNavigate } from 'react-router-dom'
import { formatUSDC, formatAddress, formatDate, STATUS_LABEL } from '../lib/arc'
import { Users, Clock, ExternalLink, Code, BarChart2, FileText, Pen, Layout, Server, Search, Tag } from 'lucide-react'

const STATUS_CLASS = ['open','hired','submitted','validated','disputed','cancelled','expired']
const CATEGORY_ICONS = {
  'smart-contract': <Code size={11} />, 'data-analysis': <BarChart2 size={11} />,
  'content': <FileText size={11} />, 'design': <Pen size={11} />,
  'frontend': <Layout size={11} />, 'backend': <Server size={11} />,
  'research': <Search size={11} />, 'other': <Tag size={11} />,
}
const CATEGORY_COLORS = {
  'smart-contract': 'rgba(99,102,241,0.1)', 'data-analysis': 'rgba(6,182,212,0.1)',
  'content': 'rgba(245,158,11,0.1)', 'design': 'rgba(244,63,94,0.1)',
  'frontend': 'rgba(139,92,246,0.1)', 'backend': 'rgba(16,185,129,0.1)',
  'research': 'rgba(99,102,241,0.1)', 'other': 'rgba(255,255,255,0.05)',
}

export default function JobCard({ jobId, core, meta }) {
  const navigate = useNavigate()
  const statusNum = Number(core.status)
  const isDemo = typeof jobId === 'string' && jobId.startsWith('d')

  return (
    <div className="glass-card" onClick={() => !isDemo && navigate(`/job/${jobId}`)}
      style={{ padding: 22, cursor: isDemo ? 'default' : 'pointer' }}>

      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className={`badge badge-${STATUS_CLASS[statusNum] || 'cancelled'}`}>
          <span className="badge-dot" />{STATUS_LABEL[statusNum] || 'OPEN'}
        </span>
        <span className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {CATEGORY_ICONS[meta.category] || <Tag size={11} />}
          {meta.category}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
        {meta.title}
      </h3>

      {/* Description */}
      <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, marginBottom: 18,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {meta.description}
      </p>

      <div className="divider" style={{ marginBottom: 16 }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em' }}>
            ${formatUSDC(core.budget)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 3 }}>USDC</span>
          </span>
          <div style={{ display: 'flex', align: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
              <Users size={12} />{core.bidCount.toString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
              <Clock size={12} />{formatDate(core.deadline)}
            </span>
          </div>
        </div>
        {!isDemo && (
          <a href={`https://testnet.arcscan.app/address/${core.client}`} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()} className="address-pill" style={{ fontSize: 10 }}>
            <ExternalLink size={9} />{formatAddress(core.client)}
          </a>
        )}
      </div>
    </div>
  )
}
