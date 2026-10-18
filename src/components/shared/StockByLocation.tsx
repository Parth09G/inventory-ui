import type { components } from '@/lib/api/schema'
import { isNegative, isZero, qty } from '@/lib/format'
import { cn } from '@/lib/utils'

type Stock = components['schemas']['StockByLocation']

/** "Shop 12 · G1 40 · G2 0": zero stock is faint, so short locations stand out (ui-plan §3.3). */
export function StockByLocation({
  stock,
  decimals,
  highlightLocationId,
}: {
  stock: Stock[] | undefined
  decimals?: number
  highlightLocationId?: number
}) {
  if (!stock?.length) return <span className="text-ink-faint">—</span>
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
      {stock.map((s) => (
        <span
          key={s.location_id}
          className={cn(
            'whitespace-nowrap tabular',
            isZero(s.qty) || isNegative(s.qty) ? 'text-ink-faint' : 'text-ink',
            highlightLocationId === s.location_id &&
              'font-medium underline decoration-steel underline-offset-2',
          )}
        >
          <span className="text-ink-muted">{shortName(s.location_name)}</span>{' '}
          {qty(s.qty, decimals)}
        </span>
      ))}
    </span>
  )
}

/** "Godown 1" → "G1"; "Shop" stays "Shop". */
export function shortName(name: string | undefined): string {
  if (!name) return ''
  const m = name.match(/^godown\s*(\d+)$/i)
  return m ? `G${m[1]}` : name
}
