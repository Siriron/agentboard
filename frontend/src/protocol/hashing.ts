import { keccak256, toBytes, toHex, stringToHex, hexToString, isHex, type Hex } from 'viem'

/** keccak256 of raw file bytes. Used for deliverable commitments. */
export async function hashFile(file: File): Promise<Hex> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return keccak256(buf)
}

/** keccak256 of UTF-8 text with line endings normalised. Used for spec and evidence text. */
export function hashText(text: string): Hex {
  return keccak256(toBytes(String(text).replace(/\r\n/g, '\n').trim()))
}

/** Re-fetch a URL and compare to a committed hash. Returns {ok, actual, reason}. */
export async function verifyUrlHash(url: string, expected: string): Promise<{ ok: boolean; actual?: Hex; reason?: string }> {
  const u = normaliseUrl(url)
  if (!u) return { ok: false, reason: 'unsupported-url' }
  try {
    const res = await fetch(u, { redirect: 'follow' })
    if (!res.ok) return { ok: false, reason: `http-${res.status}` }
    const actual = keccak256(new Uint8Array(await res.arrayBuffer()))
    return { ok: actual.toLowerCase() === String(expected).toLowerCase(), actual }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

/** Deliverables are untrusted content. Only http(s) and ipfs:// links are fetched, never executed. */
export function normaliseUrl(uri: string | null | undefined): string | null {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`
  if (/^https:\/\//i.test(uri)) return uri
  return null
}

// submit() optParams carries the deliverable location as UTF-8 bytes.
export const encodeUri = (uri: string): Hex => (uri ? stringToHex(uri) : '0x')
export function decodeUri(hex: string): string {
  try { return isHex(hex) && hex !== '0x' ? hexToString(hex) : '' } catch { return '' }
}
export { toHex }

const META_PREFIX = 'data:application/json;base64,'

// Listing and bid metadata travel in the onchain `uri` as a data URI (small) or an https/ipfs link.
export function encodeMeta(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return META_PREFIX + btoa(bin)
}
export function decodeMeta<T = Record<string, unknown>>(uri: string | null | undefined): T | null {
  if (!uri || !uri.startsWith(META_PREFIX)) return null
  try {
    const bin = atob(uri.slice(META_PREFIX.length))
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch { return null }
}
