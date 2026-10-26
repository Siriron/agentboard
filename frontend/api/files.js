// GET /api/files?jobId=<decimal> — list hosted files for a job. Public; the app re-verifies hashes.
import { list } from '@vercel/blob'
import { PREFIX, configured, sameOrigin } from './_pin-common.js'

export default async function handler(req, res) {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' })
  if (!configured()) return res.status(200).json({ configured: false, files: [] })
  const jobId = String(req.query?.jobId || '')
  if (!/^\d{1,78}$/.test(jobId)) return res.status(400).json({ error: 'Bad jobId' })
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/${jobId}/`, limit: 100 })
    const files = blobs.map(b => {
      const [, , kind, keccak, ...rest] = b.pathname.split('/')
      return { url: b.url, kind, keccak, name: rest.join('/'), size: b.size, uploadedAt: b.uploadedAt }
    })
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30')
    return res.status(200).json({ configured: true, files })
  } catch {
    return res.status(502).json({ error: 'File hosting is unreachable.' })
  }
}
