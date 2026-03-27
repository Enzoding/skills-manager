import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] text-[13px] font-medium transition-all duration-[140ms] disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:   'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:scale-[0.98]',
        secondary: 'bg-[var(--color-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-light)] hover:border-[var(--color-text-dim)]',
        ghost:     'bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]',
        danger:    'bg-[var(--color-danger-light)] text-[var(--color-danger)] border border-[rgba(255,59,48,0.15)] hover:bg-[var(--color-danger)] hover:text-white hover:border-transparent',
        icon:      'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] rounded-[5px]',
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
