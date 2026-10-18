import { Loader2 } from 'lucide-react'
import { Money } from '@/components/shared/values'
import { problemMessage } from '@/lib/api/problem'
import { isZero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CalcResult } from '../api'

/** Server totals only (D-07, D-09); dimmed while a newer calculation runs. */
export function TotalsPanel({
  calc,
  updating,
  error,
}: {
  calc: CalcResult | undefined
  updating: boolean
  error: unknown
}) {
  const t = calc?.totals
  const row = (
    label: string,
    value: string | undefined,
    opts: { neg?: boolean; strong?: boolean } = {},
  ) =>
    value !== undefined && (!isZero(value) || opts.strong) ? (
      <div className={cn('flex justify-between gap-4', opts.strong && 'font-medium')}>
        <dt className="text-ink-muted">{label}</dt>
        <dd>
          {opts.neg && '− '}
          <Money value={value} />
        </dd>
      </div>
    ) : null

  return (
    <section
      aria-label="Totals"
      aria-busy={updating}
      className="grid gap-2 rounded-lg border bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Totals</h2>
        {updating && (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Loader2 className="size-3 animate-spin" /> Updating
          </span>
        )}
      </div>
      {error ? (
        <p className="text-sm text-danger">Cannot calculate yet: {problemMessage(error)}</p>
      ) : !t ? (
        <p className="text-sm text-ink-muted">
          Totals appear when a line has an item, quantity and rate.
        </p>
      ) : (
        <dl
          className={cn('grid gap-1 text-sm tabular transition-opacity', updating && 'opacity-50')}
        >
          {row('Items', t.items_taxable)}
          {row('Charges', t.charges_taxable)}
          {row('Bill discount', t.bill_discount, { neg: true })}
          {row('Taxable value', t.taxable_total, { strong: true })}
          {t.tax_by_rate?.map((r) => (
            <div key={r.gst_rate} className="grid gap-1">
              {r.igst && !isZero(r.igst) ? (
                row(`IGST on ${r.gst_rate}%`, r.igst)
              ) : (
                <>
                  {row(`CGST on ${r.gst_rate}%`, r.cgst)}
                  {row(`SGST on ${r.gst_rate}%`, r.sgst)}
                </>
              )}
            </div>
          ))}
          {row('Round off', t.round_off)}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-2">
            <dt className="font-medium">Grand total</dt>
            <dd className="text-figure font-semibold" data-testid="grand-total">
              ₹ <Money value={t.grand_total} />
            </dd>
          </div>
          {t.amount_in_words && <p className="text-xs text-ink-muted">{t.amount_in_words}</p>}
          {row('Paid now', t.amount_paid)}
          {t.balance_due !== undefined && (
            <div className="flex justify-between gap-4 font-medium">
              <dt>Balance due</dt>
              <dd>
                <Money value={t.balance_due} />
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}
