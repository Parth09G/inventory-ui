import * as React from 'react'
import { useFieldControl } from '@/components/shared/field-context'
import { cn } from '@/lib/utils'

function Input({ className, type, ...rest }: React.ComponentProps<'input'>) {
  const props = useFieldControl(rest)
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-(--control-h) w-full min-w-0 rounded-md border border-input bg-surface px-2.5 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
