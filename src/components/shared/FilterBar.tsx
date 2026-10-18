import { Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

/** Persistent filter row above a register (design P7). Filters are bound to URL search params by the page. */
export function FilterBar({
  children,
  onClear,
  active,
}: {
  children: ReactNode
  onClear?: () => void
  active?: boolean
}) {
  return (
    <div role="search" className="mb-3 flex flex-wrap items-end gap-2">
      {children}
      {active && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-ink-muted">
          <X className="size-4" /> Clear filters
        </Button>
      )}
    </div>
  )
}

/** Text search that updates the URL after typing stops (300 ms). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label = 'Search',
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  placeholder?: string
  label?: string
}) {
  const [text, setText] = useState(value ?? '')
  const debounced = useDebouncedValue(text, 300)
  useEffect(() => {
    if ((debounced || undefined) !== value) onChange(debounced || undefined)
    // onChange identity changes every render; only the typed text matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  useEffect(() => setText(value ?? ''), [value])
  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-8"
      />
    </div>
  )
}

/** Compact labelled select for filter bars. Empty value = "all". */
export function FilterSelect<V extends string>({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string
  value: V | undefined
  onChange: (v: V | undefined) => void
  options: { value: V; label: string }[]
  allLabel?: string
}) {
  return (
    <label className="grid gap-0.5 text-xs font-medium text-ink-muted">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as V | undefined)}
        className="h-(--control-h) min-w-32 rounded-md border border-input bg-surface px-2 text-base font-normal text-ink"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
