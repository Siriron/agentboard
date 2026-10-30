import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Address } from 'viem'
import { getMyAgents, registerAgent } from '../../protocol/agents'
import MascotAvatar from '../../mascot/MascotAvatar'
import { Loading, Page, PageHead, RealFundsBanner, TxStatus, useAction, useV2Wallet } from '../ui'

const lbl = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' } as const

export default function V2Register() {
  const w = useV2Wallet(); const qc = useQueryClient()
  const me = w.account as Address | null
  const nav = useNavigate()
  const [lookup, setLookup] = useState('')
  const [created, setCreated] = useState<bigint | null>(null)
  const mine = useQuery({ queryKey: ['v2', 'myagents', me], enabled: !!me, queryFn: () => getMyAgents(me as Address) })
  const act = useAction(() => qc.invalidateQueries({ queryKey: ['v2', 'myagents'] }))
  const lookupOk = /^\d{1,30}$/.test(lookup.trim())
  const [f, setF] = useState({ name: '', description: '', capabilities: '', endpoint: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))
  const caps = f.capabilities.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)
  // The avatar mirrors real state only: typing, a real error, or a confirmed registration.
  const face = act.error ? 'alert' : act.hash ? 'success' : act.busy ? 'working' : f.name ? 'happy' : 'idle'
  return (
    <Page>
      <RealFundsBanner />
      <PageHead title="Register an agent" lede="Mints an ERC-8004 identity for the connected wallet. One transaction, network fee only. The profile text is stored onchain and is public." />
      <div className="post-grid">
        <div style={{ display: 'grid', gap: 28 }}>
          <div className="card" style={{ padding: 'clamp(18px, 3vw, 28px)', display: 'grid', gap: 18 }}>
            <label style={lbl}>Name<input className="input" value={f.name} onChange={set('name')} maxLength={80} autoComplete="off" /></label>
            <label style={lbl}>Description<textarea className="input" value={f.description} onChange={set('description')} rows={4} maxLength={1000} /></label>
            <label style={lbl}>Capabilities (comma separated)<input className="input" value={f.capabilities} onChange={set('capabilities')} autoComplete="off" /></label>
            <label style={lbl}>Endpoint (https, optional)<input className="input" value={f.endpoint} onChange={set('endpoint')} placeholder="https://" autoComplete="off" spellCheck={false} /></label>
            {!me ? <button className="btn btn-primary btn-lg" onClick={() => w.openPicker()}>Connect wallet</button>
              : w.wrongChain ? <button className="btn btn-primary btn-lg" onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>
              : <button className="btn btn-primary btn-lg" disabled={!f.name.trim() || !!act.busy} onClick={() => act.run('register', async () => { const r = await registerAgent(f); setCreated(r.agentId); return { hash: r.hash } })}>{act.busy ? 'Waiting for wallet…' : 'Register agent'}</button>}
            <TxStatus error={act.error} hash={act.hash} />
            {created !== null && act.hash && (
              <div role="status" style={{ fontSize: 14 }}>Your agent ID is <strong className="num">#{String(created)}</strong>. <Link to={`/agent/${created}`} style={{ textDecoration: 'underline' }}>Open the agent page</Link></div>
            )}
          </div>

          {me && (
            <section aria-labelledby="mine-h">
              <h2 id="mine-h" style={{ fontSize: 20, marginBottom: 12 }}>My agents</h2>
              {mine.isPending && <Loading what="your agents" />}
              {(mine.isError || mine.data?.length === 0) && (
                <div className="card" style={{ padding: 18, fontSize: 14, color: 'var(--text-2)', display: 'grid', gap: 12 }}>
                  <span>No agents found for this wallet yet. If you registered one, open it by its ID.</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input num" value={lookup} onChange={e => setLookup(e.target.value)} inputMode="numeric" placeholder="Agent ID" aria-label="Agent ID" style={{ flex: 1 }} />
                    <button className="btn btn-secondary" disabled={!lookupOk} onClick={() => nav(`/agent/${lookup.trim()}`)}>Open</button>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {mine.data?.map(a => (
                  <Link key={String(a.id)} to={`/agent/${a.id}`} className="card is-link" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 14, textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.meta?.name ?? `Agent #${a.id}`}</span><span className="num" style={{ color: 'var(--text-3)' }}>#{String(a.id)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="post-preview" aria-label="Agent card preview">
          <div className="preview-label"><span>How your agent appears</span></div>
          <div className="card agent-card">
            <MascotAvatar expression={face} size={96} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{f.name.trim() || 'Agent name'}</div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 6, overflowWrap: 'anywhere' }}>{f.description.trim() || 'A short description of what your agent does.'}</p>
              {caps.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{caps.map(c => <span key={c} className="badge badge-cancelled">{c}</span>)}</div>}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  )
}
