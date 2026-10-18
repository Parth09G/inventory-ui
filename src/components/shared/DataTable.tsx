import { Link, useNavigate, type LinkProps } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Columns3 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

export type Column<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Numbers are right-aligned (design P3). */
  align?: 'left' | 'right'
  /** Server sort field; makes the header a sort button (`sort=field` / `sort=-field`). */
  sortKey?: string
  /** CSS width, e.g. '8rem'. */
  width?: string
  /** Hidden until the user turns it on in the column picker. */
  defaultHidden?: boolean
  /** Always shown; not listed in the column picker. */
  required?: boolean
  /** Totals row cell (values come from the server, never summed here). */
  footer?: ReactNode
  /** Place in the phone card. Columns without a role are not shown on phone. */
  mobile?: 'title' | 'value' | 'subtitle' | 'meta'
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  /** Where a row opens; rows become links (keyboard and middle-click work). */
  rowLink?: (row: T) => LinkProps
  sort?: string
  onSortChange?: (sort: string | undefined) => void
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  empty: ReactNode
  /** localStorage key for the column picker. */
  storageKey?: string
  /** Accessible name for the table. */
  label: string
  rowClassName?: (row: T) => string | undefined
}

function loadHidden(key: string | undefined, columns: Column<unknown>[]): Set<string> {
  const defaults = new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id))
  if (!key) return defaults
  try {
    const saved = localStorage.getItem(`table.cols.${key}`)
    return saved ? new Set(JSON.parse(saved) as string[]) : defaults
  } catch {
    return defaults
  }
}

/**
 * Server-paged register table (ui-plan §3.3, D-33). Sticky header, column picker,
 * totals row; renders a card list below 1024 px.
 */
export function DataTable<T>(props: Props<T>) {
  const {
    columns,
    rows,
    rowKey,
    rowLink,
    sort,
    onSortChange,
    isLoading,
    error,
    onRetry,
    empty,
    storageKey,
    label,
  } = props
  const phone = useIsPhone()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(() => loadHidden(storageKey, columns as Column<unknown>[]))

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        if (storageKey) localStorage.setItem(`table.cols.${storageKey}`, JSON.stringify([...next]))
      } catch {
        /* per-viewer convenience only */
      }
      return next
    })
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  if (phone) return <CardList {...props} />

  const visible = columns.filter((c) => c.required || !hidden.has(c.id))
  const pickable = columns.filter((c) => !c.required)
  const hasFooter = visible.some((c) => c.footer !== undefined)
  const sortField = sort?.replace(/^-/, '')
  const desc = sort?.startsWith('-')

  return (
    <div className="grid gap-2">
      {storageKey && pickable.length > 0 && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-ink-muted">
                <Columns3 className="size-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-ink-muted">Show columns</DropdownMenuLabel>
              {pickable.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.has(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="max-h-[calc(100dvh-13rem)] overflow-auto rounded-lg border bg-surface">
        <table aria-label={label} className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {visible.map((c, i) => {
                const active = c.sortKey && sortField === c.sortKey
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={{ width: c.width }}
                    aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}
                    className={cn(
                      'sticky top-0 z-10 h-9 border-b bg-surface-sunken px-3 text-xs font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase',
                      c.align === 'right' ? 'text-right' : 'text-left',
                      i === 0 && 'left-0 z-20',
                    )}
                  >
                    {c.sortKey && onSortChange ? (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 uppercase hover:text-ink',
                          active && 'text-ink',
                        )}
                        onClick={() =>
                          onSortChange(
                            active && !desc ? `-${c.sortKey}` : active ? undefined : c.sortKey,
                          )
                        }
                      >
                        {c.header}
                        {active &&
                          (desc ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUp className="size-3" />
                          ))}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }, (_, r) => (
                <tr key={r}>
                  {visible.map((c) => (
                    <td key={c.id} className="h-(--row-h) border-b px-3">
                      <Skeleton
                        className={cn('h-3.5', c.align === 'right' ? 'ml-auto w-16' : 'w-3/4')}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && rows?.length === 0 && (
              <tr>
                <td colSpan={visible.length}>
                  <EmptyState>{empty}</EmptyState>
                </td>
              </tr>
            )}
            {!isLoading &&
              rows?.map((row) => {
                const link = rowLink?.(row)
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={
                      link
                        ? (e) =>
                            !(e.target as HTMLElement).closest('a,button') && void navigate(link)
                        : undefined
                    }
                    className={cn('group', link && 'cursor-pointer', props.rowClassName?.(row))}
                  >
                    {visible.map((c, i) => (
                      <td
                        key={c.id}
                        className={cn(
                          'h-(--row-h) border-b bg-surface px-3 group-hover:bg-paper',
                          c.align === 'right' && 'text-right',
                          i === 0 && 'sticky left-0',
                        )}
                      >
                        {i === 0 && link ? (
                          <Link {...link} className="font-medium text-ink hover:underline">
                            {c.cell(row)}
                          </Link>
                        ) : (
                          c.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
          {hasFooter && !isLoading && !!rows?.length && (
            <tfoot>
              <tr>
                {visible.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      'sticky bottom-0 h-9 border-t-2 border-rule-strong bg-surface-sunken px-3 font-medium',
                      c.align === 'right' && 'text-right',
                    )}
                  >
                    {c.footer ?? (i === 0 ? 'Total' : null)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function CardList<T>({ columns, rows, rowKey, rowLink, isLoading, empty, label }: Props<T>) {
  const by = (role: Column<T>['mobile']) => columns.filter((c) => c.mobile === role)
  const [title, value, subtitle, meta] = [by('title'), by('value'), by('subtitle'), by('meta')]
  if (isLoading)
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  if (!rows?.length) return <EmptyState>{empty}</EmptyState>
  return (
    <ul aria-label={label} className="grid divide-y rounded-lg border bg-surface">
      {rows.map((row) => {
        const body = (
          <div className="grid gap-0.5 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">
                {title.map((c) => (
                  <span key={c.id}>{c.cell(row)}</span>
                ))}
              </span>
              <span className="shrink-0 text-right">
                {value.map((c) => (
                  <span key={c.id}>{c.cell(row)}</span>
                ))}
              </span>
            </div>
            {(() => {
              // Skip empty values so cards never show a stray separator.
              const parts = subtitle
                .map((c) => [c.id, c.cell(row)] as const)
                .filter(([, v]) => v != null && v !== '' && v !== false)
              return parts.length > 0 ? (
                <div className="truncate text-sm text-ink-muted">
                  {parts.map(([id, v], i) => (
                    <span key={id}>
                      {i > 0 && ' · '}
                      {v}
                    </span>
                  ))}
                </div>
              ) : null
            })()}
            {meta.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {meta.map((c) => (
                  <span key={c.id}>{c.cell(row)}</span>
                ))}
              </div>
            )}
          </div>
        )
        const link = rowLink?.(row)
        return (
          <li key={rowKey(row)}>
            {link ? (
              <Link {...link} className="block hover:bg-paper">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
