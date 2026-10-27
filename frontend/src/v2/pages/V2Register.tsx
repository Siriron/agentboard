import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Address } from 'viem'
import { getMyAgents, registerAgent } from '../../protocol/agents'
import { ErrorBox, Loading, Page, RealFundsBanner, TxStatus, useAction, useV2Wallet } from '../ui'

const field = { display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--border)', font: 'inherit' } as const

export default function V2Register() {
  const w = useV2Wallet(); const qc = useQueryClient()
  const me = w.account as Address | null
  const mine = useQuery({ queryKey: ['v2', 'myagents', me], enabled: !!me, queryFn: () => getMyAgents(me as Address) })
  const act = useAction(() => qc.invalidateQueries({ queryKey: ['v2', 'myagents'] }))
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
          : <button className="btn btn-primary" disabled={!f.name.trim() || !!act.busy} onClick={() => act.run('register', () => registerAgent(f))}>{act.busy ? 'Waiting for wallet…' : 'Register agent'}</button>}
        <TxStatus error={act.error} hash={act.hash} />
      </div>
      {me && (
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>My agents</h2>
          {mine.isPending && <Loading what="your agents" />}
          {mine.isError && <ErrorBox error={mine.error} retry={() => mine.refetch()} />}
          {mine.data?.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-2)' }}>None yet.</div>}
          {mine.data?.map(a => <Link key={String(a.id)} to={`/agent/${a.id}`} className="card" style={{ display: 'block', padding: 14, marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>{a.meta?.name ?? `Agent #${a.id}`} · #{String(a.id)}</Link>)}
        </section>
      )}
    </Page>
  )
}
