import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Address } from 'viem'
import { getMyAgents, registerAgent } from '../../protocol/agents'
import { Loading, Page, RealFundsBanner, TxStatus, useAction, useV2Wallet } from '../ui'

const field = { display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', font: 'inherit' } as const

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
  return (
    <Page narrow>
      <RealFundsBanner />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 6 }}>Register an agent</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 18 }}>Mints an ERC-8004 identity for the connected wallet. One transaction, network fee only. The profile text is stored onchain and is public.</p>
      <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
        <label>Name<input value={f.name} onChange={set('name')} maxLength={80} style={field} /></label>
        <label>Description<textarea value={f.description} onChange={set('description')} rows={4} maxLength={1000} style={field} /></label>
        <label>Capabilities (comma separated)<input value={f.capabilities} onChange={set('capabilities')} style={field} /></label>
        <label>Endpoint (https, optional)<input value={f.endpoint} onChange={set('endpoint')} style={field} placeholder="https://" /></label>
        {!me ? <button className="btn btn-primary" onClick={() => w.openPicker()}>Connect wallet</button>
          : w.wrongChain ? <button className="btn btn-primary" onClick={() => w.switchChain()}>Switch to Arc Mainnet</button>
          : <button className="btn btn-primary" disabled={!f.name.trim() || !!act.busy} onClick={() => act.run('register', async () => { const r = await registerAgent(f); setCreated(r.agentId); return { hash: r.hash } })}>{act.busy ? 'Waiting for wallet…' : 'Register agent'}</button>}
        <TxStatus error={act.error} hash={act.hash} />
        {created !== null && act.hash && (
          <div role="status" style={{ fontSize: 14 }}>Your agent ID is <strong>#{String(created)}</strong>. <Link to={`/agent/${created}`}>Open the agent page</Link></div>
        )}
      </div>
      {me && (
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>My agents</h2>
          {mine.isPending && <Loading what="your agents" />}
          {(mine.isError || mine.data?.length === 0) && (
            <div className="card" style={{ padding: 16, fontSize: 14, color: 'var(--text-2)', display: 'grid', gap: 10 }}>
              <span>No agents found for this wallet yet. If you registered one, open it by its ID.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={lookup} onChange={e => setLookup(e.target.value)} inputMode="numeric" placeholder="Agent ID" aria-label="Agent ID" style={{ ...field, marginTop: 0, flex: 1 }} />
                <button className="btn btn-secondary btn-sm" disabled={!lookupOk} onClick={() => nav(`/agent/${lookup.trim()}`)}>Open</button>
              </div>
            </div>
          )}
          {mine.data?.map(a => <Link key={String(a.id)} to={`/agent/${a.id}`} className="card" style={{ display: 'block', padding: 14, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>{a.meta?.name ?? `Agent #${a.id}`} · #{String(a.id)}</Link>)}
        </section>
      )}
    </Page>
  )
}
