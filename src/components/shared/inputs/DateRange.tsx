import { useId } from 'react'
import { DateInput } from './DateInput'

/** From/To pair for filter bars. Values are ISO dates or undefined. */
export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string | undefined
  to: string | undefined
  onChange: (range: { from?: string; to?: string }) => void
}) {
  const id = useId()
  return (
    <>
      <div className="grid gap-0.5">
        <label htmlFor={`${id}-from`} className="text-xs font-medium text-ink-muted">
          From
        </label>
        <DateInput
          id={`${id}-from`}
          className="w-40"
          value={from}
          onChange={(v) => onChange({ from: v || undefined, to })}
        />
      </div>
      <div className="grid gap-0.5">
        <label htmlFor={`${id}-to`} className="text-xs font-medium text-ink-muted">
          To
        </label>
        <DateInput
          id={`${id}-to`}
          className="w-40"
          value={to}
          onChange={(v) => onChange({ from, to: v || undefined })}
        />
      </div>
    </>
  )
}
