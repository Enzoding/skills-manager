import { cn } from '@/lib/utils'

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]',
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
        'w-full bg-[var(--display-bg)] border-none outline-none text-[12.5px] text-[var(--text-primary)]',
        'font-mono leading-[1.7] resize-none p-4',
        className
      )}
      {...props}
    />
  )
}
