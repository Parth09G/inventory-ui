import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { useFieldControl } from '../field-context'

/**
 * Native select styled like Input. Used for short fixed lists: it is fast with the
 * keyboard (type-ahead) and gives the phone's own picker.
 */
export function NativeSelect({ className, ...rest }: ComponentProps<'select'>) {
  const props = useFieldControl(rest)
  return (
    <select
      className={cn(
        'h-(--control-h) w-full min-w-0 rounded-md border border-input bg-surface px-2 text-base text-ink outline-none focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
