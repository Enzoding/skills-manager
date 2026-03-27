import { cn } from '@/lib/utils'

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full bg-transparent border-none outline-none text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full bg-[var(--color-card)] border-none outline-none text-[12.5px] text-[var(--color-text)]',
        'font-mono leading-[1.7] resize-none p-4',
        className
      )}
      {...props}
    />
  )
}
