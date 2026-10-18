import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { qty } from '@/lib/format'
import type { ShortLine } from '../api'

/**
 * A refused save (422 INSUFFICIENT_STOCK) as a way forward (design P6, FR-CB-02):
 * each short line with stock elsewhere, and one click to take it from there.
 */
export function ShortagePanel({
  lines,
  alertSent,
  onTakeFrom,
}: {
  lines: { row: number; short: ShortLine }[]
  alertSent: boolean
  onTakeFrom: (row: number, locationId: number) => void
}) {
  return (
    <section
      role="alert"
      aria-label="Stock is short"
      className="grid gap-2 rounded-lg border border-danger/40 bg-danger-tint p-4"
    >
      <h2 className="flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle className="size-4" /> Not enough stock. The bill was not saved.
      </h2>
      <ul className="grid gap-2">
        {lines.map(({ row, short }) => (
          <li key={`${row}-${short.location_id}`} className="grid gap-1">
            <p>
              Line {row + 1} · <strong>{short.item_name}</strong> at {short.location_name}: needs{' '}
              {qty(short.required)} {short.unit}, has {qty(short.available)} {short.unit}.
            </p>
            {!!short.available_elsewhere?.length && (
              <div className="flex flex-wrap gap-2">
                {short.available_elsewhere.map((o) => (
                  <Button
                    key={o.location_id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onTakeFrom(row, o.location_id!)}
                  >
                    Take from {o.location_name} ({qty(o.qty)} {short.unit})
                  </Button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {alertSent && (
        <p className="text-sm text-ink-muted">The owner has been notified to reorder.</p>
      )}
    </section>
  )
}
