import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { PartyPicker } from '@/components/shared/inputs/PartyPicker'
import {
  ALL_MODES,
  emptyPayment,
  PaymentSplitEditor,
  toPaymentInput,
  type PaymentRow,
} from '@/components/shared/inputs/PaymentSplitEditor'
import { PageHeader } from '@/components/shared/PageHeader'
import { Balance, Code, DateText, Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { billsQuery } from '@/features/billing/api'
import { partyQuery, type Party } from '@/features/parties/api'
import { purchasesQuery } from '@/features/purchases/api'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useShortcut } from '@/hooks/useShortcut'
import { formError } from '@/lib/api/forms'
import { isZero, MONEY_RE, todayIST } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCreatePayment, type PaymentInput } from './api'

type Direction = 'received' | 'paid'
type OpenDoc = {
  key: string
  ref_type: 'cash_bill' | 'account_bill' | 'purchase'
  ref_id: number
  no: string
  date?: string
  due: string
}

const schema = z
  .object({
    party: z.custom<Pick<Party, 'id' | 'name'> | null>(),
    pay_date: z.string().min(1, 'Choose the date'),
    payment: z.array(z.custom<PaymentRow>()).length(1),
    allocation: z.enum(['auto', 'manual']),
    allocations: z.record(z.string(), z.string()),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.party) ctx.addIssue({ code: 'custom', path: ['party'], message: 'Choose the party' })
    const p = v.payment[0]!
    if (!MONEY_RE.test(p.amount) || isZero(p.amount))
      ctx.addIssue({ code: 'custom', path: ['payment', 0, 'amount'], message: 'Enter the amount' })
    if (p.mode === 'cheque' && !p.cheque_no.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['payment', 0, 'cheque_no'],
        message: 'Enter the cheque number',
      })
    for (const [k, a] of Object.entries(v.allocations))
      if (a && !MONEY_RE.test(a))
        ctx.addIssue({ code: 'custom', path: ['allocations', k], message: 'Enter an amount' })
  })
type Values = z.infer<typeof schema>

/** Record a receipt or a payment to a dealer, allocated to bills or purchases (FR-CU-03, ui-plan #14). */
export function NewPaymentPage({
  direction,
  partyId,
  billId,
}: {
  direction: Direction
  partyId?: number
  billId?: number
}) {
  const navigate = useNavigate()
  const create = useCreatePayment()
  const [key, renewKey] = useIdempotencyKey()
  const [alert, setAlert] = useState<string | null>(null)
  const initialParty = useQuery({ ...partyQuery(partyId ?? 0), enabled: !!partyId }).data
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      party: null,
      pay_date: todayIST(),
      payment: [emptyPayment(direction === 'received' ? 'cash' : 'bank_transfer')],
      allocation: billId ? 'manual' : 'auto',
      allocations: {},
      notes: '',
    },
  })
  const v = form.watch()
  const party = v.party

  // A party from the URL (?party=) becomes the form's party once loaded.
  useEffect(() => {
    if (initialParty && !form.getValues('party')) form.setValue('party', initialParty)
  }, [initialParty, form])
  const isReceipt = direction === 'received'
  const partyDetail = useQuery({ ...partyQuery(party?.id ?? 0), enabled: !!party }).data

  const bills = useQuery({
    ...billsQuery({ party_id: party?.id, status: 'active', page_size: 200, sort: 'bill_date' }),
    enabled: isReceipt && !!party,
  })
  const purchases = useQuery({
    ...purchasesQuery({ party_id: party?.id, page_size: 200, sort: 'received_date' }),
    enabled: !isReceipt && !!party,
  })
  const docs: OpenDoc[] = isReceipt
    ? (bills.data?.data ?? [])
        .filter((b) => !b.is_account_copy && b.balance_due && !isZero(b.balance_due))
        .map((b) => ({
          key: `b${b.id}`,
          ref_type: b.bill_type === 'cash' ? 'cash_bill' : 'account_bill',
          ref_id: b.id,
          no: b.bill_no ?? '',
          date: b.bill_date,
          due: b.balance_due!,
        }))
    : (purchases.data?.data ?? [])
        .filter((p) => p.status !== 'cancelled' && p.balance_payable && !isZero(p.balance_payable))
        .map((p) => ({
          key: `p${p.id}`,
          ref_type: 'purchase',
          ref_id: p.id,
          no: p.supplier_invoice_no ? `${p.doc_no} · ${p.supplier_invoice_no}` : p.doc_no,
          date: p.received_date,
          due: p.balance_payable!,
        }))

  // Coming from a bill: allocate its full balance and suggest that amount (once).
  const fromBill = billId
    ? docs.find((d) => d.ref_id === billId && d.ref_type !== 'purchase')
    : undefined
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (!fromBill || prefilled) return
    setPrefilled(true)
    form.setValue('allocations', { [fromBill.key]: fromBill.due })
    const [row] = form.getValues('payment')
    if (row && !row.amount) form.setValue('payment', [{ ...row, amount: fromBill.due }])
  }, [fromBill, prefilled, form])

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null)
    const p = values.payment[0]!
    const split = toPaymentInput(p)
    const body: PaymentInput = {
      direction,
      party_id: party!.id,
      pay_date: values.pay_date,
      mode: split.mode,
      amount: split.amount,
      reference: split.reference,
      cheque_no: split.cheque_no,
      cheque_date: split.cheque_date,
      bank_name: split.bank_name,
      notes: values.notes || undefined,
      auto_allocate: values.allocation === 'auto',
      allocations:
        values.allocation === 'manual'
          ? docs.flatMap((d) => {
              const a = values.allocations[d.key]
              return a && !isZero(a) ? [{ ref_type: d.ref_type, ref_id: d.ref_id, amount: a }] : []
            })
          : undefined,
    }
    try {
      const saved = await create.mutateAsync({ body, key })
      renewKey()
      toast.success(`${isReceipt ? 'Receipt' : 'Payment'} ${saved.doc_no} saved`)
      await navigate({ to: '/payments/$id', params: { id: saved.id } })
    } catch (e) {
      setAlert(formError(e, form.setError))
    }
  })
  useShortcut('ctrl+enter', () => void onSubmit(), { allowInInputs: true })

  const e = form.formState.errors
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isReceipt ? 'Record receipt' : 'Record payment to dealer'}
        back={
          <Link to="/payments" search={{ direction }} className="hover:text-ink">
            Payments
          </Link>
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert message={alert} />
        <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="grid content-start gap-1">
            <Field label={isReceipt ? 'Customer' : 'Dealer'} error={e.party?.message}>
              <Controller
                control={form.control}
                name="party"
                render={({ field }) => (
                  <PartyPicker
                    ref={field.ref}
                    kind={isReceipt ? 'customer' : 'supplier'}
                    selectedLabel={party?.name ?? ''}
                    onSelect={(p) => {
                      field.onChange(p)
                      form.setValue('allocations', {})
                    }}
                  />
                )}
              />
            </Field>
            {partyDetail && (
              <p className="text-sm text-ink-muted">
                Balance <Balance value={partyDetail.balance} className="text-ink" />
              </p>
            )}
          </div>
          <Field label="Date" error={e.pay_date?.message}>
            <Controller
              control={form.control}
              name="pay_date"
              render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
            />
          </Field>
        </section>

        <section className="grid gap-2 rounded-lg border bg-surface p-4">
          <h2 className="text-sm font-semibold">{isReceipt ? 'Amount received' : 'Amount paid'}</h2>
          <Controller
            control={form.control}
            name="payment"
            render={({ field }) => (
              <PaymentSplitEditor
                single
                value={field.value}
                onChange={field.onChange}
                modes={ALL_MODES}
                errors={e.payment as never}
              />
            )}
          />
        </section>

        {party && (
          <section className="grid gap-3 rounded-lg border bg-surface p-4">
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="mb-1 text-sm font-semibold">Apply to</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="auto"
                  className="size-4 accent-ink"
                  {...form.register('allocation')}
                />
                Oldest {isReceipt ? 'bills' : 'purchases'} first (automatic)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="manual"
                  className="size-4 accent-ink"
                  {...form.register('allocation')}
                />
                Choose {isReceipt ? 'bills' : 'purchases'}
              </label>
            </fieldset>
            {v.allocation === 'manual' &&
              (docs.length === 0 ? (
                <p className="text-ink-muted">
                  Nothing is outstanding for {party.name}; the amount stays on account.
                </p>
              ) : (
                <table aria-label="Open documents" className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                      <th className="pb-1 font-medium">{isReceipt ? 'Bill' : 'Purchase'}</th>
                      <th className="pb-1 font-medium">Date</th>
                      <th className="pb-1 text-right font-medium">Due ₹</th>
                      <th className="w-36 pb-1 text-right font-medium">Apply ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.key} className="border-t">
                        <td className="py-1.5">
                          <Code>{d.no}</Code>
                        </td>
                        <td className="py-1.5">
                          <DateText value={d.date} />
                        </td>
                        <td className="py-1.5 text-right">
                          <Money value={d.due} />
                        </td>
                        <td className="py-1.5 pl-2">
                          <Controller
                            control={form.control}
                            name={`allocations.${d.key}`}
                            render={({ field }) => (
                              <DecimalInput
                                aria-label={`Apply to ${d.no}`}
                                decimals={2}
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                className={cn(e.allocations?.[d.key] && 'border-destructive')}
                              />
                            )}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            <p className="text-xs text-ink-muted">
              Any amount not applied stays on account and is used against later{' '}
              {isReceipt ? 'bills' : 'purchases'}.
            </p>
          </section>
        )}

        <Field label="Notes">
          <Textarea rows={2} {...form.register('notes')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {isReceipt ? 'Save receipt' : 'Save payment'}
          </Button>
        </div>
      </form>
    </div>
  )
}
