import { useState, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
const listeners = new Set()
export function useToast() {
  return useCallback((msg, type = 'info') => listeners.forEach(fn => fn(msg, type)), [])
}
export function ToastContainer() {
  const [toasts, setToasts] = useState([])
  useState(() => {
    const h = (msg, type) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t.slice(-4), { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
    }
    listeners.add(h)
    return () => listeners.delete(h)
  })
  const icons = { success: <CheckCircle size={14} color="var(--green)" />, error: <XCircle size={14} color="var(--red)" />, info: <Info size={14} color="var(--purple-light)" /> }
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => setToasts(x => x.filter(i => i.id !== t.id))}>
          {icons[t.type]}<span style={{flex:1}}>{t.msg}</span><X size={12} color="rgba(255,255,255,0.3)" />
        </div>
      ))}
    </div>
  )
}
