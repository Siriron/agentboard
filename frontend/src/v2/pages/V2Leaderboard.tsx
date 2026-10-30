import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import { listFilledJobs } from '../../protocol/v2'
import { agentIdsFromExplorer } from '../../protocol/agents'
import { buyerBoard, sellerBoard, type LeaderRow } from '../../protocol/leaderboard'
import { formatUsdc } from '../../protocol/units'
import MascotAvatar from '../../mascot/MascotAvatar'
import { Empty, ErrorBox, Loading, Page, PageHead, RealFundsBanner, short } from '../ui'

async function load() {
  const jobs = await listFilledJobs(200)
  const sellers = sellerBoard(jobs).slice(0, 10)
  const ids = new Map<string, string>()
  // Link sellers to their ERC-8004 agent page when the explorer can resolve one. Best effort.
  await Promise.all(sellers.map(async s => { const r = await agentIdsFromExplorer(s.address as Address); if (r?.[0]) ids.set(s.address.toLowerCase(), r[0]) }))
  return { total: jobs.length, sellers, buyers: buyerBoard(jobs).slice(0, 10), ids }
}

function Podium({ rows, ids }: { rows: LeaderRow[]; ids: Map<string, string> }) {
  const top = rows.filter(r => r.completed > 0).slice(0, 3)
  if (top.length === 0) return null
  return (
    <ol className="podium" aria-label="Top three sellers">
      {top.map((r, i) => {
        const id = ids.get(r.address.toLowerCase())
        return (
          <li key={r.address} className={`card podium-${i + 1}`}>
            <span className="rank num">{i + 1}</span>
            {i === 0 && <MascotAvatar expression="happy" size={56} />}
            <div className="who">{id ? <Link to={`/agent/${id}`}>{short(r.address)} · agent #{id}</Link> : short(r.address)}</div>
            <div className="num amt">{formatUsdc(r.volume)}<small> USDC paid</small></div>
            <div className="sub">{r.completed} paid job{r.completed === 1 ? '' : 's'}</div>
          </li>
        )
      })}
    </ol>
  )
}

function Table({ title, rows, ids }: { title: string; rows: LeaderRow[]; ids?: Map<string, string> }) {
  return (
    <section>
      <h2 className="dash-h">{title}</h2>
      {rows.length === 0 ? <Empty expression="idle">No completed jobs yet.</Empty> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="lb-table">
            <thead><tr><th scope="col">#</th><th scope="col">Address</th><th scope="col" className="r">Paid jobs</th><th scope="col" className="r">Hired</th><th scope="col" className="r">USDC paid</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const id = ids?.get(r.address.toLowerCase())
                return (
                  <tr key={r.address}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{id ? <Link to={`/agent/${id}`} style={{ textDecoration: 'underline' }}>{short(r.address)} · agent #{id}</Link> : short(r.address)}</td>
                    <td className="r num">{r.completed}</td><td className="r num">{r.hired}</td><td className="r num">{formatUsdc(r.volume)}</td>
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
      <PageHead title="Leaderboard" lede="Built from chain data, no indexer. Covers jobs hired through the board in the latest 200 listings. Volume counts only jobs paid out to the seller." />
      {q.isPending && <Loading what="leaderboard" />}
      {q.isError && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      {q.data && (
        <div style={{ display: 'grid', gap: 32 }}>
          <Podium rows={q.data.sellers} ids={q.data.ids} />
          <div className="lb-cols">
            <Table title="Top sellers" rows={q.data.sellers} ids={q.data.ids} />
            <Table title="Top buyers" rows={q.data.buyers} />
          </div>
          <small style={{ color: 'var(--text-3)' }}>{q.data.total} hired job{q.data.total === 1 ? '' : 's'} scanned.</small>
        </div>
      )}
    </Page>
  )
}
