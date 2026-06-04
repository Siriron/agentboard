import { useState, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const listeners = new Set()

export function useToast() {
  return useCallback((msg, type = 'info') => {
    listeners.forEach(fn => fn(msg, type))
  }, [])
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useState(() => {
    const handler = (msg, type) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t.slice(-4), { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
    }
    listeners.add(handler)
    return () => listeners.delete(handler)
  })

  const icons = {
    success: <CheckCircle size={14} color="#10b981" />,
    error: <XCircle size={14} color="#f43f5e" />,
    info: <Info size={14} color="#818cf8" />,
  }

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => setToasts(x => x.filter(i => i.id !== t.id))}>
          {icons[t.type] || icons.info}
          <span style={{ flex: 1 }}>{t.msg}</span>
          <X size={12} color="rgba(255,255,255,0.3)" />
        </div>
      ))}
    </div>
  )
}
