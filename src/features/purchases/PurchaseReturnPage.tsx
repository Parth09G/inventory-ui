import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { PageHeader } from '@/components/shared/PageHeader'
import { Code, Qty, Rate } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { ApiProblem, problemMessage } from '@/lib/api/problem'
import { unitsQuery } from '@/lib/api/reference'
import { isZero, qty as fmtQty, QTY_RE, todayIST } from '@/lib/format'
import type { ShortLine } from '@/features/billing/api'
import { purchaseQuery, useCreatePurchaseReturn } from './api'

const route = getRouteApi('/_app/purchases/$id/return')

/** Goods sent back to the dealer; reduces stock (FR-PU-03, ui-plan #26). */
export function PurchaseReturnPage() {
  const { id } = route.useParams()
  const navigate = useNavigate()
  const { data: p } = useSuspenseQuery(purchaseQuery(id))
  const units = useQuery(unitsQuery())
  const create = useCreatePurchaseReturn()
  const [key, renewKey] = useIdempotencyKey()
  const [qtys, setQtys] = useState<string[]>(() => p.lines.map(() => ''))
  const [date, setDate] = useState(todayIST())
  const [reason, setReason] = useState('')
  const [alert, setAlert] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const unitId = (symbol?: string) => units.data?.find((u) => u.symbol === symbol)?.id

  const chosen = p.lines.flatMap((l, i) =>
    l.id && qtys[i] && QTY_RE.test(qtys[i]!) && !isZero(qtys[i]) ? [{ l, qty: qtys[i]! }] : [],
  )
  const problems = [
    !chosen.length && 'Enter the quantity going back for at least one line',
    reason.trim().length < 3 && 'Give a reason',
  ].filter(Boolean) as string[]

  const submit = async () => {
    setTouched(true)
    setAlert(null)
    if (problems.length) return
    try {
      const r = await create.mutateAsync({
        key,
        body: {
          purchase_id: id,
          return_date: date,
          reason: reason.trim(),
          lines: chosen.map(({ l, qty }) => ({
            purchase_line_id: l.id!,
            qty,
            unit_id: unitId(l.unit)!,
          })),
        },
      })
      renewKey()
      toast.success(`Purchase return ${r.doc_no ?? ''} saved`)
      await navigate({ to: '/purchases/$id', params: { id } })
    } catch (e) {
      if (e instanceof ApiProblem && e.code === 'INSUFFICIENT_STOCK') {
        const short = (e.body.short_lines as ShortLine[] | undefined) ?? []
        setAlert(
          'Not enough stock to send back: ' +
            short
              .map(
                (s) => `${s.item_name} at ${s.location_name} has ${fmtQty(s.available)} ${s.unit}`,
              )
              .join('; ') +
            '.',
        )
      } else setAlert(problemMessage(e))
    }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <PageHeader
        title="Return to dealer"
        back={
          <Link to="/purchases/$id" params={{ id }} className="hover:text-ink">
            Purchase {p.doc_no}
          </Link>
        }
        meta={
          <span>
            {p.supplier_name} · invoice <Code>{p.supplier_invoice_no}</Code>
          </span>
        }
      />
      <FormAlert message={alert} />
      <section tabIndex={0} className="overflow-x-auto rounded-lg border bg-surface">
        <table aria-label="Lines to return" className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Returning</th>
            </tr>
          </thead>
          <tbody>
            {p.lines.map((l, i) => (
              <tr key={l.id ?? i} className="border-t">
                <td className="px-3 py-2">{l.item_name}</td>
                <td className="px-3 py-2 text-right">
                  <Qty value={l.qty} unit={l.unit} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Rate value={l.rate} />
                </td>
                <td className="px-3 py-2">
                  <DecimalInput
                    aria-label={`Return quantity for ${l.item_name}`}
                    decimals={3}
                    value={qtys[i] ?? ''}
                    onChange={(q) => setQtys((all) => all.map((x, j) => (j === i ? q : x)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Return date">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field
          label="Reason"
          error={touched && reason.trim().length < 3 ? 'Give a reason' : undefined}
        >
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </section>
      {touched && !chosen.length && (
        <p className="text-sm text-danger">Enter the quantity going back for at least one line</p>
      )}
      <p className="text-sm text-ink-muted">
        The goods leave stock at the location they were received into, and the dealer’s balance goes
        down.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="button" disabled={create.isPending} onClick={() => void submit()}>
          Save return
        </Button>
      </div>
    </div>
  )
}
