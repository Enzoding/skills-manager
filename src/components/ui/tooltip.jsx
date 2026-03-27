import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip         = TooltipPrimitive.Root
export const TooltipTrigger  = TooltipPrimitive.Trigger

export function TooltipContent({ className, sideOffset = 6, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 px-2.5 py-1.5 text-[11.5px] font-medium rounded-[6px]',
          'bg-[var(--color-text)] text-white shadow-md',
          'animate-[fadeIn_0.1s_ease]',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
