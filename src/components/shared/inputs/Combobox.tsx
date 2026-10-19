import { Loader2 } from 'lucide-react'
import { forwardRef, useId, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useFieldControl } from '../field-context'

export type ComboboxExtra = { key: string; label: ReactNode; onSelect: () => void }

type Props<T> = {
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  /** Text shown while not searching (the current selection). */
  selectedLabel: string
  query: string
  onQueryChange: (q: string) => void
  options: T[] | undefined
  loading?: boolean
  getKey: (o: T) => string | number
  renderOption: (o: T) => ReactNode
  onSelect: (o: T) => void
  /** Fixed entries after the results, e.g. "Walk-in customer", "Add new". */
  extras?: ComboboxExtra[]
  placeholder?: string
  disabled?: boolean
  className?: string
  emptyText?: string
  /** Minimum characters before the results are relevant. */
  minQuery?: number
}

/**
 * Search-as-you-type picker (ARIA combobox). Keyboard: type to search, ↑/↓ to move,
 * Enter to choose, Esc to close, F4 to open. Enter on a choice is consumed here so a
 * surrounding grid does not also move (design §7).
 */
function ComboboxInner<T>(props: Props<T>, ref: React.ForwardedRef<HTMLInputElement>) {
  const p = useFieldControl(props)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => input.current!)
  const listId = useId()
  const options = p.options ?? []
  const extras = p.extras ?? []
  const count = options.length + extras.length
  const showResults = p.query.trim().length >= (p.minQuery ?? 1)

  const choose = (i: number) => {
    if (i < options.length) p.onSelect(options[i]!)
    else extras[i - options.length]?.onSelect()
    setOpen(false)
    p.onQueryChange('')
  }

  return (
    <Popover open={open && !p.disabled} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <input
          ref={input}
          id={p.id}
          aria-describedby={p['aria-describedby']}
          role="combobox"
          aria-label={p['aria-label']}
          aria-invalid={p['aria-invalid'] || undefined}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && count ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={p.disabled}
          placeholder={p.placeholder}
          value={open ? p.query : p.selectedLabel}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            p.onQueryChange(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'F4' || (e.key === 'ArrowDown' && !open)) {
              e.preventDefault()
              setOpen(true)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, count - 1))
            } else if (e.key === 'ArrowUp' && open) {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (
              e.key === 'Enter' &&
              open &&
              count > 0 &&
              (showResults || active >= options.length)
            ) {
              e.preventDefault()
              e.stopPropagation()
              choose(active)
            } else if (e.key === 'Escape' && open) {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              p.onQueryChange('')
            }
          }}
          onBlur={() => {
            setOpen(false)
            p.onQueryChange('')
          }}
          className={cn(
            'h-(--control-h) w-full min-w-0 rounded-md border border-input bg-surface px-2.5 text-base outline-none placeholder:text-ink-faint focus-visible:border-ring disabled:opacity-50 aria-invalid:border-destructive',
            p.className,
          )}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target === input.current) e.preventDefault()
        }}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={p['aria-label']}
          className="max-h-80 overflow-y-auto py-1"
        >
          {showResults && p.loading && options.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-ink-muted">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </li>
          )}
          {showResults && !p.loading && options.length === 0 && (
            <li className="px-3 py-2 text-ink-muted">{p.emptyText ?? 'No matches.'}</li>
          )}
          {!showResults && options.length === 0 && extras.length === 0 && (
            <li className="px-3 py-2 text-ink-muted">Type to search.</li>
          )}
          {options.map((o, i) => (
            <li
              key={p.getKey(o)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={cn('cursor-pointer px-3 py-1.5', i === active && 'bg-steel-tint')}
            >
              {p.renderOption(o)}
            </li>
          ))}
          {extras.map((x, j) => {
            const i = options.length + j
            return (
              <li
                key={x.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  'cursor-pointer border-t px-3 py-2 text-steel',
                  i === active && 'bg-steel-tint',
                )}
              >
                {x.label}
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export const Combobox = forwardRef(ComboboxInner) as <T>(
  p: Props<T> & { ref?: React.Ref<HTMLInputElement> },
) => ReturnType<typeof ComboboxInner>
