import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[var(--border)] text-[13px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.42)] transition-all duration-[120ms] disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:   'bg-[var(--accent)] text-white border-[rgba(80,22,12,.28)] hover:bg-[var(--accent-hover)] active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(36,34,29,.16)]',
        secondary: 'bg-[var(--control-bg)] text-[var(--text-secondary)] hover:bg-[var(--control-pressed)] hover:border-[var(--case-edge)]',
        ghost:     'bg-transparent text-[var(--text-tertiary)] border-[var(--border-light)] hover:bg-[var(--control-bg)] hover:text-[var(--text-primary)]',
        danger:    'bg-[var(--danger-bg)] text-[var(--danger)] border-[rgba(183,47,42,.2)] hover:bg-[var(--danger)] hover:text-white hover:border-transparent',
        icon:      'bg-transparent text-[var(--text-tertiary)] border-transparent hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]',
      },
      size: {
        default: 'px-3 py-[6px]',
        sm:      'px-[11px] py-[5px] text-[12px]',
        icon:    'p-[5px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export function Button({ className, variant, size, children, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
}
