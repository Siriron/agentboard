// POST /api/upload — host a deliverable / dispute file in Vercel Blob, committed by keccak256.
// The caller must sign the upload with a wallet that is the job's buyer, seller or a decider
// (checked against the chain), so this cannot be used as anonymous free storage.
// Needs a Vercel Blob store connected to the project (adds BLOB_READ_WRITE_TOKEN).

import { put } from '@vercel/blob'
import { getAddress, isAddress, keccak256, verifyMessage } from 'viem'
import { KINDS, MAX_BYTES, KERNEL, ROUTER, PREFIX, client, configured, sameOrigin } from './_pin-common.js'
import { kernelAbi, routerAbi } from './_abi.js'

const hits = new Map() // best-effort per-address limiter (resets on cold start)
function limited(addr) {
  const now = Date.now()
  const arr = (hits.get(addr) || []).filter(t => now - t < 60_000)
  if (arr.length >= 6) return true
  arr.push(now); hits.set(addr, arr)
  return false
}

export default async function handler(req, res) {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!configured()) return res.status(503).json({ error: 'File hosting is not set up on this deployment.' })

  const { jobId, kind, name, contentBase64, hash, address, signature, issuedAt } = req.body || {}
  if (!/^\d{1,78}$/.test(String(jobId))) return res.status(400).json({ error: 'Bad jobId' })
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Bad kind' })
  if (!isAddress(address || '')) return res.status(400).json({ error: 'Bad address' })
  if (typeof contentBase64 !== 'string' || contentBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) return res.status(413).json({ error: 'File too large (4 MB max)' })
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) return res.status(400).json({ error: 'Bad hash' })
  const issued = Number(issuedAt)
  if (!Number.isFinite(issued) || Math.abs(Date.now() / 1000 - issued) > 600) return res.status(400).json({ error: 'Signature expired. Retry.' })

  const bytes = Buffer.from(contentBase64, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return res.status(413).json({ error: 'File too large (4 MB max)' })
  if (keccak256(new Uint8Array(bytes)).toLowerCase() !== hash.toLowerCase()) return res.status(400).json({ error: 'Hash does not match the file' })

  const message = `AgentBoard upload\nJob: ${jobId}\nKind: ${kind}\nHash: ${hash}\nIssued: ${issued}`
  let ok = false
  try { ok = await verifyMessage({ address, message, signature }) } catch { ok = false }
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
  try {
    // Served as an opaque download so an uploaded page or script can never run in a browser.
    const blob = await put(`${PREFIX}/${jobId}/${kind}/${hash.toLowerCase()}/${safeName}`, bytes, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream' })
    return res.status(200).json({ url: blob.url, keccak: hash.toLowerCase() })
  } catch {
    return res.status(502).json({ error: 'File hosting failed. Try again.' })
  }
}
