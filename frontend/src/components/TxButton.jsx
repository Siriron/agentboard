import { useState } from 'react'
import { ExternalLink, CheckCircle } from 'lucide-react'

// BUG FIX 11: TxButton was not propagating errors to parent — errors silently swallowed
// Also: style prop was being passed but not applied to the button element
export default function TxButton({ onClick, children, className = 'btn btn-primary', disabled, showTx = true, style }) {
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [txError, setTxError] = useState(null)

  async function handle() {
    setLoading(true)
    setTxHash(null)
    setTxError(null)
    try {
      const result = await onClick()
      if (result?.txHash) setTxHash(result.txHash)
    } catch (e) {
      // User rejection — don't show scary errors
      if (e.code === 4001 || e.message?.includes('rejected')) {
        setTxError('Transaction rejected')
      } else if (e.message?.includes('insufficient')) {
        setTxError('Insufficient USDC balance')
      } else {
        setTxError('Transaction failed')
        console.error('TxButton error:', e)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button className={className} onClick={handle} disabled={disabled || loading} style={style}>
        {loading
          ? <><span className="spinner" style={{ width: 13, height: 13 }} />Processing…</>
          : children}
      </button>
      {showTx && txHash && (
        <a
          href={`http://testnet.arcscan.app/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--green)', textDecoration: 'none',
            padding: '5px 10px',
            background: 'var(--green-dim)',
            border: '1px solid rgba(0,232,122,0.2)',
            borderRadius: 2,
          }}
        >
          <CheckCircle size={10} />
          Tx confirmed · {txHash.slice(0, 10)}…{txHash.slice(-6)}
          <ExternalLink size={9} style={{ marginLeft: 2 }} />
        </a>
      )}
      {txError && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)' }}>
          ✕ {txError}
        </span>
      )}
    </div>
  )
}
