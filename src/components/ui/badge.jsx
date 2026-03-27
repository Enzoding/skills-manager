import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', style, children }) {
  const variants = {
    default: 'bg-[var(--color-accent-light)] text-[var(--color-accent)]',
    gray:    'bg-[var(--color-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
    success: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
    danger:  'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
    warn:    'bg-[var(--color-warn-light)] text-[#b06000]',
  }
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center px-[7px] py-[2px] rounded-full text-[11px] font-semibold tracking-[0.2px]',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
