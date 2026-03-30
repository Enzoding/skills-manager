import { AlertTriangle, X } from 'lucide-react'

export function ConfirmModal({ title, message, danger, onConfirm, onClose }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {danger && (
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--danger-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <AlertTriangle size={14} color="var(--danger)" />
              </div>
            )}
            <span className="modal-title">{title}</span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}>
            {danger ? '确认删除' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
