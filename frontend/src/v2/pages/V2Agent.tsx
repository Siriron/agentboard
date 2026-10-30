import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAgent, getReputation } from '../../protocol/agents'
import MascotAvatar from '../../mascot/MascotAvatar'
import { Empty, ErrorBox, Loading, Page, short } from '../ui'
import { normaliseUrl } from '../../protocol/hashing'

export default function V2Agent() {
  const { address: param } = useParams()
  let id: bigint | null = null
  try { id = BigInt(param ?? '') } catch { id = null }
  const q = useQuery({ queryKey: ['v2', 'agent', String(id)], enabled: id !== null, queryFn: async () => { const a = await getAgent(id as bigint); return a ? { agent: a, rep: await getReputation(id as bigint) } : null } })
  if (id === null) return <Page><Empty>Agents are looked up by their numeric ID, for example /agent/12.</Empty></Page>
  if (q.isPending) return <Page narrow><Loading what="agent" /></Page>
  if (q.isError) return <Page narrow><ErrorBox error={q.error} retry={() => q.refetch()} /></Page>
  if (!q.data) return <Page narrow><Empty>No agent with ID {String(id)}.</Empty></Page>
  const { agent, rep } = q.data
  const ep = normaliseUrl(agent.meta?.endpoint)
  return (
    <Page narrow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <MascotAvatar expression="idle" size={84} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.05, overflowWrap: 'anywhere' }}>{agent.meta?.name ?? `Agent #${agent.id}`}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>ERC-8004 agent <span className="num">#{String(agent.id)}</span> · owner <span style={{ fontFamily: 'var(--font-mono)' }}>{short(agent.owner)}</span></div>
        </div>
      </div>
      <div className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
        {agent.meta?.description && <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{agent.meta.description}</p>}
        {agent.meta?.capabilities && agent.meta.capabilities.length > 0 && <div style={{ fontSize: 13 }}>Capabilities: {agent.meta.capabilities.join(', ')}</div>}
        {ep && <div style={{ fontSize: 13 }}>Endpoint: <a href={ep} target="_blank" rel="noopener noreferrer nofollow">{agent.meta?.endpoint}</a></div>}
        {!agent.meta && <div style={{ fontSize: 13, color: 'var(--text-3)', wordBreak: 'break-all' }}>Metadata URI: {agent.uri || '(none)'}</div>}
      </div>
      <div className="card" style={{ padding: 18, marginTop: 14 }}>
        <strong>Reputation</strong>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          {rep.count === 0n ? 'No feedback recorded yet.' : <>{String(rep.count)} feedback entr{rep.count === 1n ? 'y' : 'ies'} from {rep.clients} account{rep.clients === 1 ? '' : 's'}{rep.average !== null && <> · average score {rep.average.toFixed(2)}</>}</>}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Read from the ERC-8004 reputation registry. Anyone except the agent&apos;s owner can leave feedback, so treat scores as signals, not guarantees.</p>
      </div>
      <p style={{ marginTop: 16, fontSize: 13 }}><Link to="/register">Register an agent</Link></p>
    </Page>
  )
}
