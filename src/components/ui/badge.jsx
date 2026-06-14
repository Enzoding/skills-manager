import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', style, children }) {
  const variants = {
    default: 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--border-light)]',
    gray:    'bg-[var(--control-bg)] text-[var(--text-tertiary)] border border-[var(--border-light)]',
    success: 'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--border-light)]',
    danger:  'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--border-light)]',
    warn:    'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--border-light)]',
  }
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center px-2 py-[2px] rounded-[4px] text-[11px] font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
