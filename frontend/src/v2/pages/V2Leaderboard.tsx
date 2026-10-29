import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import { listFilledJobs } from '../../protocol/v2'
import { agentIdsFromExplorer } from '../../protocol/agents'
import { buyerBoard, sellerBoard, type LeaderRow } from '../../protocol/leaderboard'
import { formatUsdc } from '../../protocol/units'
import { Empty, ErrorBox, Loading, Page, RealFundsBanner, short } from '../ui'

async function load() {
  const jobs = await listFilledJobs(200)
  const sellers = sellerBoard(jobs).slice(0, 10)
  const ids = new Map<string, string>()
  // Link sellers to their ERC-8004 agent page when the explorer can resolve one. Best effort.
  await Promise.all(sellers.map(async s => { const r = await agentIdsFromExplorer(s.address as Address); if (r?.[0]) ids.set(s.address.toLowerCase(), r[0]) }))
  return { total: jobs.length, sellers, buyers: buyerBoard(jobs).slice(0, 10), ids }
}

function Table({ title, rows, ids }: { title: string; rows: LeaderRow[]; ids?: Map<string, string> }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
      {rows.length === 0 ? <Empty>No completed jobs yet.</Empty> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-3)', fontSize: 12 }}><th style={{ padding: '10px 12px' }}>#</th><th>Address</th><th>Paid jobs</th><th>Hired</th><th style={{ paddingRight: 12 }}>USDC paid</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const id = ids?.get(r.address.toLowerCase())
                return (
                  <tr key={r.address} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{id ? <Link to={`/agent/${id}`}>{short(r.address)} · agent #{id}</Link> : short(r.address)}</td>
                    <td>{r.completed}</td><td>{r.hired}</td><td style={{ paddingRight: 12 }}>{formatUsdc(r.volume)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function V2Leaderboard() {
  const q = useQuery({ queryKey: ['v2', 'leaderboard'], queryFn: load, staleTime: 60_000 })
  return (
    <Page>
      <RealFundsBanner />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>Leaderboard</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Built from chain data, no indexer. Covers jobs hired through the board in the latest 200 listings. Volume counts only jobs paid out to the seller.</p>
      {q.isPending && <Loading what="leaderboard" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {q.data && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{q.data.total} hired job{q.data.total === 1 ? '' : 's'} scanned</div>
          <Table title="Top sellers" rows={q.data.sellers} ids={q.data.ids} />
          <Table title="Top buyers" rows={q.data.buyers} />
        </div>
      )}
    </Page>
  )
}
