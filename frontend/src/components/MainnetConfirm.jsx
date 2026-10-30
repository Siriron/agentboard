import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldAlert } from 'lucide-react'

// Replaces window.confirm with an accessible dialog. Same rule as before: once per session.
const Ctx = createContext(null)
export const useConfirmMainnet = () => useContext(Ctx)

export function MainnetConfirmProvider({ children }) {
  const [open, setOpen] = useState(false)
  const resolver = useRef(null)
  const confirmRef = useRef(null)
  const lastFocus = useRef(null)

  const confirm = useCallback(() => new Promise(resolve => {
    lastFocus.current = document.activeElement
    resolver.current = resolve
    setOpen(true)
  }), [])

  const close = useCallback(result => {
    setOpen(false)
    resolver.current?.(result); resolver.current = null
    lastFocus.current?.focus?.()
  }, [])

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') close(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, close])

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {open && createPortal(
        <div className="mc-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
          <div className="mc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mc-t" aria-describedby="mc-d">
            <div className="mc-icon" aria-hidden><ShieldAlert size={22} /></div>
            <h2 id="mc-t">Switch to Arc Mainnet?</h2>
            <p id="mc-d">Mainnet uses real USDC. Transactions cost real money and cannot be undone. Use testnet if you only want to try the flow.</p>
            <div className="mc-actions">
              <button className="btn btn-secondary" onClick={() => close(false)}>Stay on testnet</button>
              <button ref={confirmRef} className="btn btn-primary mc-go" onClick={() => close(true)}>Continue to mainnet</button>
            </div>
          </div>
        </div>, document.body)}
    </Ctx.Provider>
  )
}
