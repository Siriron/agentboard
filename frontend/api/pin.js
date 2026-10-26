// POST /api/pin — host a deliverable / dispute file on IPFS (Pinata), committed by keccak256.
// Secrets stay here (PINATA_JWT). The caller must sign the upload with a wallet that is a buyer,
// seller or decider of the job, so the endpoint cannot be used as anonymous free storage.
//
// Env: PINATA_JWT, V2_KERNEL, V2_ROUTER, optional ARC_MAINNET_RPC, PIN_ALLOWED_ORIGINS (comma list).

import { getAddress, isAddress, keccak256, verifyMessage } from 'viem'
import { APP_TAG, KINDS, MAX_BYTES, KERNEL, ROUTER, client, configured, cors } from './_pin-common.js'
import { kernelAbi, routerAbi } from './_abi.js'

const hits = new Map() // best-effort per-address limiter (resets on cold start)
function limited(addr) {
  const now = Date.now()
  const arr = (hits.get(addr) || []).filter(t => now - t < 60_000)
  if (arr.length >= 6) return true
  arr.push(now); hits.set(addr, arr)
  return false
}

export const pinMessage = ({ jobId, kind, hash, issuedAt }) => `AgentBoard pin\nJob: ${jobId}\nKind: ${kind}\nHash: ${hash}\nIssued: ${issuedAt}`

export default async function handler(req, res) {
  const originOk = cors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!originOk) return res.status(403).json({ error: 'Origin not allowed' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!configured()) return res.status(503).json({ error: 'Hosting is not configured on this deployment.' })

  const b = req.body || {}
  const { jobId, kind, name, mime, contentBase64, hash, address, signature, issuedAt } = b
  if (!/^\d{1,78}$/.test(String(jobId))) return res.status(400).json({ error: 'Bad jobId' })
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Bad kind' })
  if (!isAddress(address || '')) return res.status(400).json({ error: 'Bad address' })
  if (typeof contentBase64 !== 'string' || contentBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) return res.status(413).json({ error: 'File too large (5 MB max)' })
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) return res.status(400).json({ error: 'Bad hash' })
  const issued = Number(issuedAt)
  if (!Number.isFinite(issued) || Math.abs(Date.now() / 1000 - issued) > 600) return res.status(400).json({ error: 'Signature expired. Retry.' })

  const bytes = Buffer.from(contentBase64, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return res.status(413).json({ error: 'File too large (5 MB max)' })
  if (keccak256(new Uint8Array(bytes)).toLowerCase() !== hash.toLowerCase()) return res.status(400).json({ error: 'Hash does not match the file' })

  let ok = false
  try { ok = await verifyMessage({ address, message: pinMessage({ jobId: String(jobId), kind, hash, issuedAt: String(issued) }), signature }) } catch { ok = false }
  if (!ok) return res.status(401).json({ error: 'Bad signature' })
  const who = getAddress(address)
  if (limited(who)) return res.status(429).json({ error: 'Too many uploads. Wait a minute.' })

  try {
    const pc = client()
    const job = await pc.readContract({ address: KERNEL, abi: kernelAbi, functionName: 'getJob', args: [BigInt(jobId)] })
    if (Number(job.status) === 0) return res.status(404).json({ error: 'Unknown job' })
    let allowed = [job.client, job.provider].some(a => a.toLowerCase() === who.toLowerCase())
    if (!allowed) {
      const rs = await pc.readContract({ address: ROUTER, abi: routerAbi, functionName: 'jobState', args: [BigInt(jobId)] })
      allowed = (rs[4] || []).some(a => a.toLowerCase() === who.toLowerCase())
    }
    if (!allowed) return res.status(403).json({ error: 'Only the buyer, seller or a decider of this job can upload.' })
  } catch {
    return res.status(502).json({ error: 'Could not verify the job onchain. Try again.' })
  }

  const safeName = String(name || 'file').replace(/[^\w.\- ]/g, '_').slice(0, 80)
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: typeof mime === 'string' ? mime.slice(0, 100) : 'application/octet-stream' }), safeName)
  form.append('pinataMetadata', JSON.stringify({ name: `${APP_TAG}:${jobId}:${kind}:${safeName}`, keyvalues: { app: APP_TAG, jobId: String(jobId), kind, keccak: hash.toLowerCase(), uploader: who.toLowerCase(), filename: safeName } }))
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))
  try {
    const r = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', { method: 'POST', headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` }, body: form })
    if (!r.ok) return res.status(502).json({ error: 'The hosting provider rejected the upload.' })
    const j = await r.json()
    return res.status(200).json({ cid: j.IpfsHash, uri: `ipfs://${j.IpfsHash}`, keccak: hash.toLowerCase() })
  } catch {
    return res.status(502).json({ error: 'The hosting provider is unreachable.' })
  }
}
