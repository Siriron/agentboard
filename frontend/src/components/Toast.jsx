import { useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// BUG FIX: using module-level variable for toastFn breaks HMR and React strict mode
// Use a ref pattern instead
const listeners = new Set()

export function useToast() {
  return useCallback((msg, type = 'info') => {
    listeners.forEach(fn => fn(msg, type))
  }, [])
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  // Register this instance's handler
  useState(() => {
    const handler = (msg, type) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t.slice(-4), { id, msg, type }]) // max 5 toasts
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
    }
    listeners.add(handler)
    return () => listeners.delete(handler)
  })

  const icons = {
    success: <CheckCircle size={13} color="var(--green)" />,
    error: <XCircle size={13} color="var(--red)" />,
    info: <Info size={13} color="var(--accent)" />,
  }

  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} style={{ cursor: 'pointer' }} onClick={() => dismiss(t.id)}>
          {icons[t.type] || icons.info}
          <span style={{ flex: 1 }}>{t.msg}</span>
          <X size={10} color="var(--text-muted)" />
        </div>
      ))}
    </div>
  )
}
