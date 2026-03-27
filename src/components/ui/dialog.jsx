import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog        = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal  = DialogPrimitive.Portal
export const DialogClose   = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/20 backdrop-blur-[6px]',
        'data-[state=open]:animate-[fadeIn_0.15s_ease]',
        className
      )}
      {...props}
    />
  )
}

export function DialogContent({ className, children, onClose, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92%] max-w-[500px]',
          'bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px]',
          'shadow-[var(--shadow-modal)]',
          'data-[state=open]:animate-[slideUp_0.18s_ease]',
          'focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3.5 top-3.5 rounded-[5px] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] transition-all duration-[140ms] focus:outline-none"
          onClick={onClose}
        >
          <X size={15} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn('flex items-center justify-between px-[18px] pt-4 pb-[13px] border-b border-[var(--color-border-light)]', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-[15px] font-semibold text-[var(--color-text)]', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }) {
  return (
    <div className={cn('px-[18px] py-[18px] overflow-y-auto', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-[18px] py-3',
        'border-t border-[var(--color-border-light)] bg-[var(--color-bg)]',
        'rounded-b-[10px]',
        className
      )}
      {...props}
    />
  )
}
