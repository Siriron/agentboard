// GET /api/pins?jobId=<decimal> — list hosted files for a job. Public; the app re-verifies hashes.
import { APP_TAG, configured, cors } from './_pin-common.js'

export default async function handler(req, res) {
  const originOk = cors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!originOk) return res.status(403).json({ error: 'Origin not allowed' })
  if (!configured()) return res.status(200).json({ configured: false, pins: [] })
  const jobId = String(req.query?.jobId || '')
  if (!/^\d{1,78}$/.test(jobId)) return res.status(400).json({ error: 'Bad jobId' })
  const kv = encodeURIComponent(JSON.stringify({ app: { value: APP_TAG, op: 'eq' }, jobId: { value: jobId, op: 'eq' } }))
  try {
    const r = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=100&metadata[keyvalues]=${kv}`, { headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` } })
    if (!r.ok) return res.status(502).json({ error: 'The hosting provider rejected the request.' })
    const j = await r.json()
    const pins = (j.rows || []).map(p => ({
      cid: p.ipfs_pin_hash, kind: p.metadata?.keyvalues?.kind, keccak: p.metadata?.keyvalues?.keccak,
      uploader: p.metadata?.keyvalues?.uploader, name: p.metadata?.keyvalues?.filename, size: p.size, date: p.date_pinned,
    }))
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60')
    return res.status(200).json({ configured: true, pins })
  } catch {
    return res.status(502).json({ error: 'The hosting provider is unreachable.' })
  }
}
