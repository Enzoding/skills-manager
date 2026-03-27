import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

function ToastItem({ toast, onRemove }) {
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setAlive(false); setTimeout(onRemove, 220) }, 3000)
    return () => clearTimeout(t)
  }, [])

  const icons = {
    success: <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0 }} />,
    error:   <XCircle     size={14} color="var(--danger)"  style={{ flexShrink: 0 }} />,
    info:    <Info        size={14} color="var(--accent)"  style={{ flexShrink: 0 }} />,
  }

  return (
    <div className={`toast-item ${toast.type || 'info'}`}
      style={{ opacity: alive ? 1 : 0, transform: alive ? 'none' : 'translateX(12px)', transition: 'opacity .2s, transform .2s' }}>
      {icons[toast.type] || icons.info}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button className="toast-close" onClick={() => { setAlive(false); setTimeout(onRemove, 220) }}>
        <X size={13} />
      </button>
    </div>
  )
}

export function Toast({ toasts }) {
  const [list, setList] = useState([])
  useEffect(() => setList(toasts), [toasts])

  return (
    <div className="toast-stack">
      {list.map(t => (
        <ToastItem key={t.id} toast={t}
          onRemove={() => setList(l => l.filter(x => x.id !== t.id))} />
      ))}
    </div>
  )
}
