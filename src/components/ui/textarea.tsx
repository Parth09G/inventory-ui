import * as React from 'react'
import { useFieldControl } from '@/components/shared/field-context'
import { cn } from '@/lib/utils'

function Textarea({ className, ...rest }: React.ComponentProps<'textarea'>) {
  const props = useFieldControl(rest)
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
