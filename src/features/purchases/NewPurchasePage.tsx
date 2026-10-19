import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { DateInput } from '@/components/shared/inputs/DateInput'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { GstRateSelect } from '@/components/shared/inputs/GstRateSelect'
import { ItemPicker } from '@/components/shared/inputs/ItemPicker'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PartyPicker } from '@/components/shared/inputs/PartyPicker'
import { ALL_MODES, PaymentSplitEditor } from '@/components/shared/inputs/PaymentSplitEditor'
import { focusNextCell, LineGrid, type LineColumn } from '@/components/shared/line-grid/LineGrid'
import { PageHeader } from '@/components/shared/PageHeader'
import { StockByLocation } from '@/components/shared/StockByLocation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Item } from '@/features/inventory/api'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useShortcut } from '@/hooks/useShortcut'
import { ApiProblem, applyFieldErrors, problemMessage } from '@/lib/api/problem'
import { locationsQuery, settingsQuery, unitsQuery } from '@/lib/api/reference'
import { rate as fmtRate } from '@/lib/format'
import { useCreatePurchase } from './api'
import {
  emptyPurchase,
  emptyPurchaseLine,
  purchaseSchema,
  toPurchaseInput,
  type PurchaseValues,
} from './purchase-form'

/** Purchase entry: goods received from a dealer into a godown or the shop (FR-PU-01/02, ui-plan #24). */
export function NewPurchasePage({ prefillItem }: { prefillItem?: Item }) {
  const navigate = useNavigate()
  const { data: settings } = useSuspenseQuery(settingsQuery())
  const { data: locations } = useSuspenseQuery(locationsQuery())
  const units = useQuery(unitsQuery())
  const create = useCreatePurchase()
  const [key, renewKey] = useIdempotencyKey()
  const [alert, setAlert] = useState<string | null>(null)
  const active = locations.filter((l) => l.is_active !== false)
  // Goods usually arrive at a godown (FR-PU-01).
  const defaultLocation = String((active.find((l) => l.kind === 'godown') ?? active[0])?.id ?? '')
  const form = useForm<PurchaseValues>({
    resolver: zodResolver(purchaseSchema) as never,
    defaultValues: emptyPurchase(defaultLocation, prefillItem),
  })
  const lines = useFieldArray({ control: form.control, name: 'lines', keyName: 'fid' })
  const v = form.watch()
  const e = form.formState.errors
  const unitDecimals = (id: string) => units.data?.find((u) => String(u.id) === id)?.decimals ?? 3

  const columns: LineColumn[] = [
    {
      id: 'item',
      header: 'Item',
      label: 'Item',
      minWidth: '15rem',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.item`}
          render={({ field }) => (
            <ItemPicker
              ref={field.ref}
              aria-label={`Line ${i + 1} item`}
              aria-invalid={!!e.lines?.[i]?.item}
              value={field.value ?? undefined}
              onChange={(item) => {
                const line = form.getValues(`lines.${i}`)
                form.setValue(`lines.${i}`, {
                  ...line,
                  item,
                  unit_id: String(item.base_unit.id),
                  gst_rate: item.gst_rate,
                })
                requestAnimationFrame(() => {
                  const el = document.activeElement as HTMLElement | null
                  if (el) focusNextCell(el)
                })
              }}
            />
          )}
        />
      ),
    },
    {
      id: 'unit',
      header: 'Unit',
      label: 'Unit',
      width: '5.5rem',
      render: (i) => {
        const item = v.lines[i]?.item
        return (
          <NativeSelect
            aria-label={`Line ${i + 1} unit`}
            disabled={!item}
            {...form.register(`lines.${i}.unit_id`)}
          >
            {!item && <option value="">—</option>}
            {(item?.units ?? []).map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.symbol}
              </option>
            ))}
          </NativeSelect>
        )
      },
    },
    {
      id: 'location',
      header: 'Into',
      label: 'Received into',
      width: '8.5rem',
      render: (i) => (
        <NativeSelect
          aria-label={`Line ${i + 1} location`}
          {...form.register(`lines.${i}.location_id`)}
        >
          {active.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </NativeSelect>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      label: 'Quantity',
      width: '6.5rem',
      align: 'right',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.qty`}
          render={({ field }) => (
            <DecimalInput
              ref={field.ref}
              aria-label={`Line ${i + 1} quantity`}
              aria-invalid={!!e.lines?.[i]?.qty}
              decimals={unitDecimals(v.lines[i]?.unit_id ?? '')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ),
    },
    {
      id: 'rate',
      header: 'Rate ₹',
      label: 'Rate ₹ (before GST)',
      width: '7.5rem',
      align: 'right',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.rate`}
          render={({ field }) => (
            <DecimalInput
              ref={field.ref}
              aria-label={`Line ${i + 1} rate`}
              aria-invalid={!!e.lines?.[i]?.rate}
              decimals={4}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ),
    },
    {
      id: 'discount',
      header: 'Disc. ₹',
      label: 'Discount ₹',
      width: '6.5rem',
      align: 'right',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.discount_amt`}
          render={({ field }) => (
            <DecimalInput
              ref={field.ref}
              aria-label={`Line ${i + 1} discount`}
              decimals={2}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ),
    },
    {
      id: 'gst',
      header: 'GST',
      label: 'GST rate',
      width: '5.5rem',
      render: (i) => (
        <GstRateSelect
          aria-label={`Line ${i + 1} GST`}
          data-enter-skip
          {...form.register(`lines.${i}.gst_rate`)}
        />
      ),
    },
  ]

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null)
    const { body, lineIndex } = toPurchaseInput(values)
    try {
      const saved = await create.mutateAsync({ body, key })
      renewKey()
      toast.success(`Purchase ${saved.doc_no} saved`)
      await navigate({ to: '/purchases/$id', params: { id: saved.id } })
    } catch (err) {
      if (!(err instanceof ApiProblem)) return setAlert(problemMessage(err))
      if (err.code === 'DUPLICATE') {
        form.setError(
          'supplier_invoice_no',
          {
            message: `Invoice ${values.supplier_invoice_no} from ${values.supplier?.name} is already entered`,
          },
          { shouldFocus: true },
        )
      } else if (err.code === 'VALIDATION_FAILED') {
        const mapped = err.errors.map((x) => ({
          ...x,
          field: x.field?.replace(
            /^lines\[(\d+)\]/,
            (_, n: string) => `lines[${lineIndex[Number(n)] ?? n}]`,
          ),
        }))
        const rest = applyFieldErrors(form.setError, mapped)
        if (rest.length) setAlert(rest.map((x) => x.message).join(' '))
      } else setAlert(problemMessage(err))
    }
  })
  useShortcut('ctrl+enter', () => void onSubmit(), { allowInInputs: true })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <PageHeader
        title="New purchase"
        back={
          <Link to="/purchases" className="hover:text-ink">
            Purchases
          </Link>
        }
        meta="Adds stock at the receiving location and updates each item’s average cost."
      />
      <FormAlert message={alert} />
      <section className="grid gap-3 rounded-lg border bg-surface p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_10rem]">
        <Field label="Dealer" error={e.supplier?.message}>
          <Controller
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <PartyPicker
                ref={field.ref}
                kind="supplier"
                selectedLabel={field.value?.name ?? ''}
                onSelect={(p) => {
                  field.onChange(p)
                  // Inter-state when the dealer's state differs from the shop's (IGST).
                  form.setValue(
                    'is_interstate',
                    !!p.state_code && p.state_code !== settings.state_code,
                  )
                }}
              />
            )}
          />
        </Field>
        <Field label="Dealer invoice no." error={e.supplier_invoice_no?.message}>
          <Input className="code" {...form.register('supplier_invoice_no')} />
        </Field>
        <Field label="Invoice date" error={e.supplier_invoice_dt?.message}>
          <Controller
            control={form.control}
            name="supplier_invoice_dt"
            render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Received on">
          <Controller
            control={form.control}
            name="received_date"
            render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Received into" error={e.location_id?.message} hint="Lines can go elsewhere">
          <NativeSelect
            {...form.register('location_id', {
              onChange: (ev: React.ChangeEvent<HTMLSelectElement>) =>
                form.setValue(
                  'lines',
                  form.getValues('lines').map((l) => ({ ...l, location_id: ev.target.value })),
                ),
            })}
          >
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm lg:col-span-3">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            {...form.register('is_interstate')}
          />
          Inter-state purchase (IGST)
        </label>
      </section>

      <div className="grid gap-1">
        <LineGrid
          label="Purchase lines"
          count={lines.fields.length}
          rowKey={(i) => lines.fields[i]!.fid}
          columns={columns}
          onAdd={() => lines.append(emptyPurchaseLine(v.location_id), { shouldFocus: false })}
          onRemove={(i) =>
            lines.fields.length > 1
              ? lines.remove(i)
              : form.setValue(`lines.${i}`, emptyPurchaseLine(v.location_id))
          }
          rowDetail={(i) => {
            const item = v.lines[i]?.item
            const err = e.lines?.[i]
            const msg =
              err?.item?.message ??
              err?.qty?.message ??
              err?.rate?.message ??
              err?.discount_amt?.message
            if (!item) return msg ? <span className="text-danger">{msg}</span> : null
            return (
              <span className="flex flex-wrap gap-x-4">
                {msg && <span className="text-danger">{msg}</span>}
                <span>
                  Stock: <StockByLocation stock={item.stock} decimals={item.base_unit.decimals} />
                </span>
                {item.last_purchase_rate && (
                  <span>
                    Last purchase ₹ {fmtRate(item.last_purchase_rate)} / {item.base_unit.symbol}
                  </span>
                )}
                {item.avg_cost && (
                  <span>
                    Avg cost ₹ {fmtRate(item.avg_cost)} / {item.base_unit.symbol}
                  </span>
                )}
              </span>
            )
          }}
          summary={(i) => {
            const l = v.lines[i]!
            const unit = l.item?.units?.find((u) => String(u.unit_id) === l.unit_id)?.symbol
            return {
              title: l.item?.name ?? <span className="text-ink-muted">Choose an item</span>,
              detail: l.item ? `${l.qty || '—'} ${unit ?? ''} × ₹ ${l.rate || '—'}` : undefined,
            }
          }}
          addLabel="Add item"
        />
        {(e.lines?.message || e.lines?.root?.message) && (
          <p className="text-sm text-danger">{e.lines?.message ?? e.lines?.root?.message}</p>
        )}
      </div>

      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-[9rem_9rem_1fr]">
        <Field label="Freight ₹" hint="Spread into item cost" error={e.freight?.message}>
          <Controller
            control={form.control}
            name="freight"
            render={({ field }) => (
              <DecimalInput decimals={2} value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field label="Other charges ₹" error={e.other_charges?.message}>
          <Controller
            control={form.control}
            name="other_charges"
            render={({ field }) => (
              <DecimalInput decimals={2} value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field label="Notes">
          <Textarea rows={1} {...form.register('notes')} />
        </Field>
      </section>

      <section className="grid gap-2 rounded-lg border bg-surface p-4">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" className="size-4 accent-ink" {...form.register('pay_now')} />
          Paid the dealer now
        </label>
        {v.pay_now && (
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
        )}
        <p className="text-xs text-ink-muted">
          Totals and tax are worked out by the server when you save; the dealer’s balance is updated
          with them.
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Save purchase
        </Button>
      </div>
    </form>
  )
}
