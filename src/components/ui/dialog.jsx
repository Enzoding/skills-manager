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
        'fixed inset-0 z-50 bg-[rgba(30,29,25,.34)]',
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
          'bg-[var(--card-bg)] border border-[var(--case-edge)] rounded-[6px]',
          'shadow-[var(--shadow-xl)]',
          'data-[state=open]:animate-[slideUp_0.18s_ease]',
          'focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3.5 top-3.5 rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-all duration-[120ms] focus:outline-none"
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
      className={cn('flex items-center justify-between px-[18px] pt-4 pb-[13px] border-b border-[var(--case-edge)] bg-[rgba(255,255,255,.12)]', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-[14px] font-bold uppercase text-[var(--text-primary)]', className)}
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
        'border-t border-[var(--case-edge)] bg-[rgba(36,34,29,.045)]',
        'rounded-b-[6px]',
        className
      )}
      {...props}
    />
  )
}
