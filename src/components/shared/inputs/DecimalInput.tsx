import { forwardRef, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { useFieldControl } from '../field-context'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
  /** Allowed decimal places: 2 money, 3 quantity, 4 rate (D-07). */
  decimals: number
}

/**
 * Number field that keeps the typed string (never a float). Keystrokes that would
 * make it invalid are ignored, so the value is always a decimal string or ''.
 */
export const DecimalInput = forwardRef<HTMLInputElement, Props>(function DecimalInput(
  { value, onChange, decimals, className, ...rest },
  ref,
) {
  const props = useFieldControl(rest)
  const pattern = decimals > 0 ? new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`) : /^\d*$/
  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/,/g, '')
        if (pattern.test(v)) onChange(v)
      }}
      className={cn(
        'h-(--control-h) w-full min-w-0 rounded-md border border-input bg-surface px-2 text-right text-base tabular outline-none placeholder:text-ink-faint focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
})
