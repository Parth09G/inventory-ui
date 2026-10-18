import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { useShortcut } from '@/hooks/useShortcut'
import { cn } from '@/lib/utils'

export type LineColumn = {
  id: string
  header: ReactNode
  /** Field label on phone and for screen readers. */
  label: string
  width?: string
  /** For the one flexible column (the item), so fixed columns cannot squeeze it. */
  minWidth?: string
  align?: 'left' | 'right'
  /** The cell's input for row i (bound to the form by the caller). */
  render: (i: number) => ReactNode
  /** Hide on the phone sheet (e.g. a read-only total shown in the card instead). */
  desktopOnly?: boolean
}

export type LineSummary = { title: ReactNode; detail?: ReactNode; value?: ReactNode }

type Props = {
  label: string
  count: number
  rowKey: (i: number) => string
  columns: LineColumn[]
  onAdd: () => void
  onRemove: (i: number) => void
  /** Second line under a row: hints, stock, server messages. */
  rowDetail?: (i: number) => ReactNode
  rowTone?: (i: number) => 'danger' | 'warning' | undefined
  /** Phone card content for row i. */
  summary: (i: number) => LineSummary
  addLabel?: string
}

const FOCUSABLE =
  'input:not([disabled]):not([type=hidden]):not([aria-hidden]), select:not([disabled]), textarea:not([disabled])'

/**
 * Moves focus to the next cell of the grid that contains `from`. Returns false at the end.
 * Controls marked `data-enter-skip` (rarely changed, e.g. the discount % / ₹ toggle) are
 * skipped by Enter but stay reachable with Tab.
 */
export function focusNextCell(from: HTMLElement): boolean {
  const grid = from.closest('[data-line-grid]')
  if (!grid) return false
  const cells = [...grid.querySelectorAll<HTMLElement>(`[data-cell] :is(${FOCUSABLE})`)].filter(
    (el) => el === from || !el.hasAttribute('data-enter-skip'),
  )
  const next = cells[cells.indexOf(from) + 1]
  next?.focus()
  return !!next
}

/**
 * Keyboard line entry shared by every line document (D-30, design §7).
 * Desktop: Enter → next cell (a new line after the last cell), Alt+L add, Alt+D remove.
 * Below 1024 px: line cards with a bottom-sheet editor (D-27).
 */
export function LineGrid(p: Props) {
  const phone = useIsPhone()
  return phone ? <LineCards {...p} /> : <DesktopGrid {...p} />
}

function DesktopGrid({
  label,
  count,
  rowKey,
  columns,
  onAdd,
  onRemove,
  rowDetail,
  rowTone,
  addLabel,
}: Props) {
  const ref = useRef<HTMLTableElement>(null)
  // Row to focus once the row count has changed (after add or remove).
  const focusRow = useRef<number | null>(null)

  useEffect(() => {
    if (focusRow.current === null) return
    ref.current
      ?.querySelector<HTMLElement>(
        `tr[data-row="${focusRow.current}"] [data-cell] :is(${FOCUSABLE})`,
      )
      ?.focus()
    focusRow.current = null
  }, [count])

  const add = () => {
    focusRow.current = count
    onAdd()
  }
  const currentRow = () => {
    const tr = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('tr[data-row]')
    return tr && ref.current?.contains(tr) ? Number(tr.dataset.row) : null
  }

  useShortcut('alt+l', add, { allowInInputs: true })
  useShortcut(
    'alt+d',
    () => {
      const i = currentRow()
      if (i === null) return
      focusRow.current = Math.max(0, Math.min(i, count - 2))
      onRemove(i)
    },
    { allowInInputs: true },
  )

  return (
    <div className="grid gap-2">
      <div className="rounded-lg border bg-surface">
        <table
          ref={ref}
          data-line-grid
          role="grid"
          aria-label={label}
          className="w-full border-separate border-spacing-0 text-sm"
          onKeyDown={(e) => {
            if (
              e.key !== 'Enter' ||
              e.defaultPrevented ||
              e.shiftKey ||
              e.ctrlKey ||
              e.metaKey ||
              e.altKey
            )
              return
            const target = e.target as HTMLElement
            if (!target.closest('[data-cell]')) return
            e.preventDefault()
            if (!focusNextCell(target)) add()
          }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="w-8 border-b bg-surface-sunken px-2 text-right text-xs font-medium text-ink-muted"
              >
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  style={{ width: c.width, minWidth: c.minWidth }}
                  className={cn(
                    'h-9 border-b bg-surface-sunken px-1.5 text-xs font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {c.header}
                </th>
              ))}
              <th className="w-10 border-b bg-surface-sunken" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }, (_, i) => {
              const detail = rowDetail?.(i)
              const tone = rowTone?.(i)
              return [
                <tr
                  key={rowKey(i)}
                  data-row={i}
                  className={cn(
                    tone === 'danger' && 'bg-danger-tint',
                    tone === 'warning' && 'bg-warning-tint',
                  )}
                >
                  <td
                    className={cn(
                      'px-2 pt-1.5 text-right align-top text-ink-faint tabular',
                      !detail && 'border-b pb-1.5',
                    )}
                  >
                    <span className="inline-block pt-1.5">{i + 1}</span>
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      data-cell={c.id}
                      className={cn(
                        'px-1.5 pt-1.5 align-top',
                        !detail && 'border-b pb-1.5',
                        c.align === 'right' && 'text-right',
                      )}
                    >
                      {c.render(i)}
                    </td>
                  ))}
                  <td className={cn('px-1 pt-1.5 align-top', !detail && 'border-b pb-1.5')}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tabIndex={-1}
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => onRemove(i)}
                    >
                      <Trash2 className="size-4 text-ink-muted" />
                    </Button>
                  </td>
                </tr>,
                detail ? (
                  <tr
                    key={`${rowKey(i)}-d`}
                    className={cn(
                      tone === 'danger' && 'bg-danger-tint',
                      tone === 'warning' && 'bg-warning-tint',
                    )}
                  >
                    <td className="border-b" />
                    <td
                      colSpan={columns.length + 1}
                      className="border-b px-1.5 pb-2 text-sm text-ink-muted"
                    >
                      {detail}
                    </td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> {addLabel ?? 'Add line'}
        </Button>
        <span className="text-xs text-ink-muted">
          <kbd className="code">Enter</kbd> next cell · <kbd className="code">Alt+L</kbd> add line ·{' '}
          <kbd className="code">Alt+D</kbd> remove line
        </span>
      </div>
    </div>
  )
}

function LineCards({
  label,
  count,
  rowKey,
  columns,
  onAdd,
  onRemove,
  rowDetail,
  rowTone,
  summary,
  addLabel,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const open = editing !== null && editing < count
  return (
    <div className="grid gap-2">
      {count > 0 && (
        <ul aria-label={label} className="grid divide-y rounded-lg border bg-surface">
          {Array.from({ length: count }, (_, i) => {
            const s = summary(i)
            const tone = rowTone?.(i)
            return (
              <li
                key={rowKey(i)}
                className={cn(
                  tone === 'danger' && 'bg-danger-tint',
                  tone === 'warning' && 'bg-warning-tint',
                )}
              >
                <button
                  type="button"
                  onClick={() => setEditing(i)}
                  className="grid w-full gap-0.5 px-3 py-2.5 text-left"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{s.title}</span>
                    <span className="shrink-0 tabular">{s.value}</span>
                  </span>
                  {s.detail && <span className="text-sm text-ink-muted">{s.detail}</span>}
                  {rowDetail?.(i) && <span className="text-sm text-ink-muted">{rowDetail(i)}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onAdd()
          setEditing(count)
        }}
      >
        <Plus className="size-4" /> {addLabel ?? 'Add line'}
      </Button>
      <Sheet open={open} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>Line {editing + 1}</SheetTitle>
                <SheetDescription className="sr-only">Edit the line</SheetDescription>
              </SheetHeader>
              <div className="grid gap-3 px-4">
                {columns
                  .filter((c) => !c.desktopOnly)
                  .map((c) => (
                    <div key={c.id} className="grid gap-1">
                      <span className="text-sm font-medium">{c.label}</span>
                      {c.render(editing)}
                    </div>
                  ))}
                {rowDetail?.(editing) && (
                  <div className="text-sm text-ink-muted">{rowDetail(editing)}</div>
                )}
              </div>
              <SheetFooter className="flex-row justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onRemove(editing)
                    setEditing(null)
                  }}
                >
                  <Trash2 className="size-4" /> Remove line
                </Button>
                <Button type="button" onClick={() => setEditing(null)}>
                  Done
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
