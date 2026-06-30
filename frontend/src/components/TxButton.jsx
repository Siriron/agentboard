import { useState } from 'react'
import { ExternalLink, CheckCircle, XCircle } from 'lucide-react'
export default function TxButton({ onClick, children, className = 'btn btn-primary', disabled, showTx = true, style }) {
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [txError, setTxError] = useState(null)
  async function handle() {
    setLoading(true); setTxHash(null); setTxError(null)
    try {
      const r = await onClick()
      if (r?.txHash) setTxHash(r.txHash)
    } catch(e) {
      if (e.code===4001||e.message?.includes('rejected')) setTxError('Rejected in wallet')
      else if (e.message?.includes('insufficient')) setTxError('Insufficient USDC balance')
      else { setTxError('Transaction failed'); console.error(e) }
    } finally { setLoading(false) }
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <button className={className} onClick={handle} disabled={disabled||loading} style={style}>
        {loading ? <><span className="spinner" style={{width:13,height:13}}/>Processing…</> : children}
      </button>
      {showTx && txHash && (
        <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',gap:6,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--green)',textDecoration:'none',padding:'6px 12px',background:'var(--green-dim)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:8}}>
          <CheckCircle size={11}/>Confirmed · {txHash.slice(0,10)}…{txHash.slice(-6)}<ExternalLink size={10}/>
        </a>
      )}
      {txError && (
        <div style={{display:'inline-flex',alignItems:'center',gap:6,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--red)',padding:'6px 12px',background:'var(--red-dim)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:8}}>
          <XCircle size={11}/>{txError}
        </div>
      )}
    </div>
  )
}
