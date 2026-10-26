import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isHex, type Hex } from 'viem'
import { readReceipt } from '../../protocol/v2'
import { formatUsdc } from '../../protocol/units'
import { Empty, ErrorBox, Loading, Page, explorerTx, short } from '../ui'

const fmt = (v: unknown): string => typeof v === 'bigint' ? v.toString() : Array.isArray(v) ? v.map(fmt).join(', ') : String(v)

export default function V2Receipt() {
  const { hash } = useParams()
  const ok = isHex(hash ?? '') && (hash as string).length === 66
  const q = useQuery({ queryKey: ['v2', 'receipt', hash], enabled: ok, queryFn: () => readReceipt(hash as Hex) })
  if (!ok) return <Page><Empty>That is not a transaction hash.</Empty></Page>
  if (q.isPending) return <Page><Loading what="receipt" /></Page>
  if (q.isError) return <Page><ErrorBox error={q.error} retry={() => q.refetch()} /></Page>
  if (!q.data) return <Page><Empty>No receipt found yet. If you just sent this, wait a second and refresh.</Empty></Page>
  const r = q.data
  return (
    <Page narrow>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 6 }}>Receipt</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Read directly from Arc Mainnet. Nothing here comes from the app.</p>
      <div className="card" style={{ padding: 18, display: 'grid', gap: 8, fontSize: 14 }}>
        <div>Status: <strong style={{ color: r.status === 'success' ? 'var(--green)' : 'var(--red)' }}>{r.status}</strong> in block {String(r.block)}</div>
        <div>From {short(r.from)}{r.to && <> to {short(r.to)}</>}</div>
        <div><a href={explorerTx(r.hash)} target="_blank" rel="noopener noreferrer">Open in explorer</a></div>
        {r.usdc.length > 0 && <div><strong>USDC moved</strong>{r.usdc.map((m, i) => <div key={i}>{formatUsdc(m.amount)} USDC · {short(m.from)} → {short(m.to)}</div>)}</div>}
        {r.events.length > 0 && <div><strong>Protocol events</strong>{r.events.map((e, i) => (
          <details key={i} style={{ fontSize: 13 }}><summary>{e.contract}.{e.name}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{Object.entries(e.args).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n')}</pre></details>
        ))}</div>}
      </div>
    </Page>
  )
}
