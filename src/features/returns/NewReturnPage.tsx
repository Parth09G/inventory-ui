import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useForm, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import {
  ALL_MODES,
  emptyPayment,
  PaymentSplitEditor,
  toPaymentInput,
  type PaymentRow,
} from '@/components/shared/inputs/PaymentSplitEditor'
import { PageHeader } from '@/components/shared/PageHeader'
import { Code, Money, Qty } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { billQuery } from '@/features/billing/api'
import type { Bill } from '@/features/billing/bill-form'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useIsPhone } from '@/hooks/useMediaQuery'
import { formError } from '@/lib/api/forms'
import { locationsQuery } from '@/lib/api/reference'
import { isZero, MONEY_RE, QTY_RE, todayIST } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import { useCreateReturn } from './api'

const schema = z
  .object({
    cn_date: z.string().min(1, 'Choose the date'),
    reason: z.string().trim().min(3, 'Give a reason (at least 3 characters)'),
    settlement: z.enum(['refund', 'adjust_ledger']),
    refund: z.array(z.custom<PaymentRow>()),
    lines: z.array(z.object({ qty: z.string(), location_id: z.string(), restock: z.boolean() })),
  })
  .superRefine((v, ctx) => {
    if (!v.lines.some((l) => QTY_RE.test(l.qty) && !isZero(l.qty)))
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Enter the quantity coming back for at least one line',
      })
    v.lines.forEach((l, i) => {
      if (l.qty && !QTY_RE.test(l.qty))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'qty'], message: 'Enter a quantity' })
    })
    const r = v.refund[0]
    if (v.settlement === 'refund' && (!r || !MONEY_RE.test(r.amount) || isZero(r.amount)))
      ctx.addIssue({
        code: 'custom',
        path: ['refund', 0, 'amount'],
        message: 'Enter the refund amount',
      })
  })
type Values = z.infer<typeof schema>

/** Sales return against a bill (FR-RT-01/02, ui-plan #11). */
export function NewReturnPage({ billId }: { billId: number }) {
  const navigate = useNavigate()
  const { data: bill } = useSuspenseQuery(billQuery(billId))
  const autoApproved = useCan('return.approve')
  const create = useCreateReturn()
  const [key, renewKey] = useIdempotencyKey()
  const [alert, setAlert] = useState<string | null>(null)
  const isCash = bill.bill_type === 'cash' && bill.affects_stock !== false
  const walkIn = !bill.customer.party_id
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      cn_date: todayIST(),
      reason: '',
      settlement: walkIn ? 'refund' : 'adjust_ledger',
      refund: [emptyPayment('cash')],
      lines: bill.lines.map((l) => ({
        qty: '',
        location_id: l.location_id ? String(l.location_id) : '',
        restock: isCash,
      })),
    },
  })
  const v = form.watch()
  const e = form.formState.errors

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null)
    const lines = bill.lines.flatMap((l, i) => {
      const f = values.lines[i]!
      if (!f.qty || isZero(f.qty) || !l.id || !l.unit_id) return []
      return [
        {
          bill_line_id: l.id,
          qty: f.qty,
          unit_id: l.unit_id,
          location_id: isCash && f.restock && f.location_id ? Number(f.location_id) : undefined,
          restock: isCash ? f.restock : false,
        },
      ]
    })
    try {
      const cn = await create.mutateAsync({
        key,
        body: {
          bill_id: billId,
          cn_date: values.cn_date,
          reason: values.reason,
          settlement: values.settlement,
          refund: values.settlement === 'refund' ? toPaymentInput(values.refund[0]!) : undefined,
          lines,
        },
      })
      renewKey()
      toast.success(
        cn.status === 'pending'
          ? 'Return sent to the owner for approval'
          : `Credit note ${cn.cn_no ?? ''} created`,
      )
      await navigate({ to: '/returns/$id', params: { id: cn.id } })
    } catch (err) {
      setAlert(formError(err, form.setError))
    }
  })

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Return goods"
        back={
          <Link to="/bills/$id" params={{ id: billId }} className="hover:text-ink">
            Bill {bill.bill_no}
          </Link>
        }
        meta={
          <span>
            {bill.customer.name} · against <Code>{bill.bill_no}</Code>
            {!autoApproved && ' · The owner approves this before the credit note is issued.'}
          </span>
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert message={alert} />
        <ReturnLines form={form} lines={bill.lines} isCash={isCash} />
        {(e.lines?.message || e.lines?.root?.message) && (
          <p className="text-sm text-danger">{e.lines?.message ?? e.lines?.root?.message}</p>
        )}
        <p className="text-sm text-ink-muted">
          You can return up to the quantity sold, less anything already returned; the server checks
          this.
        </p>

        <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Credit note date" error={e.cn_date?.message}>
            <Controller
              control={form.control}
              name="cn_date"
              render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field label="Reason" error={e.reason?.message}>
            <Textarea rows={2} {...form.register('reason')} />
          </Field>
        </section>

        <section className="grid gap-3 rounded-lg border bg-surface p-4">
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="mb-1 text-sm font-semibold">Settle by</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="adjust_ledger"
                disabled={walkIn}
                className="size-4 accent-ink"
                {...form.register('settlement')}
              />
              Credit the customer’s ledger
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="refund"
                className="size-4 accent-ink"
                {...form.register('settlement')}
              />
              Refund the money
            </label>
          </fieldset>
          {walkIn && (
            <p className="text-sm text-ink-muted">
              A walk-in sale can only be settled by a refund.
            </p>
          )}
          {v.settlement === 'refund' && (
            <Controller
              control={form.control}
              name="refund"
              render={({ field }) => (
                <PaymentSplitEditor
                  single
                  value={field.value}
                  onChange={field.onChange}
                  modes={ALL_MODES}
                  errors={e.refund as never}
                />
              )}
            />
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {autoApproved ? 'Create credit note' : 'Send for approval'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Return quantities per bill line: a table on desktop, cards on phone (D-27). */
function ReturnLines({
  form,
  lines,
  isCash,
}: {
  form: UseFormReturn<Values>
  lines: Bill['lines']
  isCash: boolean
}) {
  const phone = useIsPhone()
  const e = form.formState.errors.lines
  const qtyInput = (i: number, description: string) => (
    <Controller
      control={form.control}
      name={`lines.${i}.qty`}
      render={({ field }) => (
        <DecimalInput
          aria-label={`Return quantity for ${description}`}
          placeholder={phone ? 'Returning' : undefined}
          decimals={3}
          value={field.value}
          onChange={field.onChange}
          aria-invalid={!!e?.[i]?.qty}
        />
      )}
    />
  )
  const qtyError = (i: number) =>
    e?.[i]?.qty && <p className="mt-1 text-xs text-danger">{e[i]?.qty?.message}</p>

  if (phone)
    return (
      <ul aria-label="Lines to return" className="grid divide-y rounded-lg border bg-surface">
        {lines.map((l, i) => (
          <li key={l.id ?? i} className="grid gap-2 px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{l.description}</span>
              <span className="shrink-0 text-sm text-ink-muted">
                Sold <Qty value={l.qty} unit={l.unit} /> @ <Money value={l.rate} />
              </span>
            </div>
            {qtyInput(i, l.description ?? '')}
            {qtyError(i)}
            {isCash && <RestockControls form={form} index={i} description={l.description ?? ''} />}
          </li>
        ))}
      </ul>
    )

  return (
    <section className="overflow-x-auto rounded-lg border bg-surface">
      <table aria-label="Lines to return" className="w-full text-sm">
        <thead>
          <tr className="bg-surface-sunken text-left text-xs tracking-wide text-ink-muted uppercase">
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 text-right font-medium">Sold</th>
            <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
            <th className="w-32 px-3 py-2 text-right font-medium">Returning</th>
            {isCash && <th className="px-3 py-2 font-medium">Back to stock</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id ?? i} className="border-t align-top">
              <td className="px-3 py-2">{l.description}</td>
              <td className="px-3 py-2 text-right">
                <Qty value={l.qty} unit={l.unit} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={l.rate} />
              </td>
              <td className="px-3 py-2">
                {qtyInput(i, l.description ?? '')}
                {qtyError(i)}
              </td>
              {isCash && (
                <td className="px-3 py-2">
                  <RestockControls form={form} index={i} description={l.description ?? ''} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** Restock toggle and the location the goods go back to (FR-RT-01). */
function RestockControls({
  form,
  index,
  description,
}: {
  form: UseFormReturn<Values>
  index: number
  description: string
}) {
  const locations = useQuery(locationsQuery())
  const restock = form.watch(`lines.${index}.restock`)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4 accent-ink"
          aria-label={`Restock ${description}`}
          {...form.register(`lines.${index}.restock`)}
        />
        Restock
      </label>
      {restock ? (
        <NativeSelect
          aria-label={`Return ${description} to`}
          className="w-36"
          {...form.register(`lines.${index}.location_id`)}
        >
          {(locations.data ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <span className="text-ink-muted">Damaged, not restocked</span>
      )}
    </div>
  )
}
