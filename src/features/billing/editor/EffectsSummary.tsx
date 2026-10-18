import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownRight, BookText, Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { locationsQuery } from '@/lib/api/reference'
import { isZero, money } from '@/lib/format'
import type { CalcResult } from '../api'
import { isCompleteLine, type BillFormValues } from '../bill-form'

/** What saving will do to stock and the ledger (design P5). */
export function EffectsSummary({
  values,
  calc,
}: {
  values: BillFormValues
  calc: CalcResult | undefined
}) {
  const locations = useQuery(locationsQuery())
  const lines = values.lines.filter(isCompleteLine)
  const due = calc?.totals?.balance_due
  const c = values.customer
  const items: { icon: ReactNode; text: ReactNode; tone?: 'danger' | 'warning' }[] = []

  if (values.bill_type === 'account')
    items.push({ icon: <Package className="size-4" />, text: 'No stock change (Account bill).' })
  else if (lines.length) {
    const shown = lines.slice(0, 3).map((l) => {
      const unit =
        l.item?.units?.find((u) => String(u.unit_id) === l.unit_id)?.symbol ??
        l.item?.base_unit.symbol
      const loc = locations.data?.find((x) => String(x.id) === l.location_id)?.name
      return `${l.qty} ${unit} ${l.item?.name} from ${loc ?? '—'}`
    })
    items.push({
      icon: <ArrowDownRight className="size-4" />,
      text: (
        <>
          Stock out: {shown.join('; ')}
          {lines.length > 3 && `; and ${lines.length - 3} more`}
        </>
      ),
    })
  }

  if (calc?.totals && due !== undefined) {
    if (c.mode === 'party' && c.party)
      items.push({
        icon: <BookText className="size-4" />,
        text: isZero(due)
          ? `Paid in full; nothing added to ${c.party.name}’s balance.`
          : `₹ ${money(due)} added to ${c.party.name}’s balance (credit).`,
      })
    else if (!isZero(due))
      items.push({
        icon: <AlertTriangle className="size-4" />,
        text: 'Walk-in customers must pay in full. Add payments, or choose a named customer for credit.',
        tone: 'danger',
      })
  }
  const w = calc?.credit_warning
  if (w)
    items.push({
      icon: <AlertTriangle className="size-4" />,
      tone: 'warning',
      text: `Over the credit limit: outstanding ₹ ${money(w.outstanding)} + this bill ₹ ${money(w.this_bill)}, limit ₹ ${money(w.credit_limit)}.`,
    })

  if (!items.length) return null
  return (
    <section
      aria-label="What saving will do"
      className="grid gap-1.5 rounded-lg border bg-surface p-4 text-sm"
    >
      <h2 className="font-semibold">On save</h2>
      <ul className="grid gap-1.5">
        {items.map((x, i) => (
          <li
            key={i}
            className={
              x.tone === 'danger'
                ? 'flex gap-2 text-danger'
                : x.tone === 'warning'
                  ? 'flex gap-2 text-warning'
                  : 'flex gap-2'
            }
          >
            <span className="mt-0.5 shrink-0 text-ink-muted">{x.icon}</span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The walk-in full-payment rule (BR-09), checked against the server's balance due. */
export function walkInUnpaid(values: BillFormValues, calc: CalcResult | undefined): boolean {
  return (
    values.customer.mode !== 'party' &&
    !!calc?.totals?.balance_due &&
    !isZero(calc.totals.balance_due)
  )
}
