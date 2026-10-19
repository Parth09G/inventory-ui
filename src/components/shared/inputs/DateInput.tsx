import { CalendarDays } from 'lucide-react'
import { forwardRef, useRef, useState, type ComponentProps } from 'react'
import { formatDateInput, parseDateInput } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useFieldControl } from '../field-context'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  /** ISO date "YYYY-MM-DD", or '' when empty. */
  value: string | undefined
  onChange: (iso: string) => void
}

/**
 * Date field typed as DD-MM-YYYY whatever the browser locale (design P12, D-20).
 * The value is the ISO string; it never goes through Date and time zones.
 * The calendar button opens the native picker for mouse and touch users.
 */
export const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  { value, onChange, className, onBlur, ...rest },
  ref,
) {
  const props = useFieldControl(rest)
  const [text, setText] = useState(formatDateInput(value))
  const [invalid, setInvalid] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  // Follow outside changes to the value (React's "adjust state on prop change" pattern).
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(formatDateInput(value))
    setInvalid(false)
  }

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false)
      if (value) onChange('')
      return
    }
    const iso = parseDateInput(text)
    setInvalid(!iso)
    if (iso) {
      setText(formatDateInput(iso))
      if (iso !== value) onChange(iso)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          commit()
          onBlur?.(e)
        }}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        aria-invalid={invalid || props['aria-invalid'] || undefined}
        className="h-(--control-h) w-full min-w-0 rounded-md border border-input bg-surface py-1 pr-9 pl-2.5 text-base tabular outline-none placeholder:text-ink-faint focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive"
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        disabled={props.disabled}
        onClick={() => picker.current?.showPicker?.()}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-ink-muted hover:text-ink"
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 size-0 opacity-0"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && <p className="mt-1 text-sm text-danger">Use DD-MM-YYYY</p>}
    </div>
  )
})
