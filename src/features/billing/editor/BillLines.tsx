import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { ItemPicker } from '@/components/shared/inputs/ItemPicker'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { focusNextCell, LineGrid, type LineColumn } from '@/components/shared/line-grid/LineGrid'
import { StockByLocation } from '@/components/shared/StockByLocation'
import { Money } from '@/components/shared/values'
import { locationsQuery, unitsQuery } from '@/lib/api/reference'
import { qty } from '@/lib/format'
import type { CalcResult, ShortLine } from '../api'
import { emptyLine, type BillFormValues } from '../bill-form'
import { PriceHints } from './PriceHints'

type Props = {
  form: UseFormReturn<BillFormValues>
  calc: CalcResult | undefined
  /** Form row of each calculated line. */
  calcIndex: number[]
  /** Short lines by form row (from the calculation or a refused save). */
  shortages: Map<number, ShortLine>
  defaultLocationId: number | undefined
}

export function BillLines({ form, calc, calcIndex, shortages, defaultLocationId }: Props) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
    keyName: 'fid',
  })
  const units = useQuery(unitsQuery())
  const locations = useQuery(locationsQuery())
  const values = form.watch()
  const isCash = values.bill_type === 'cash'
  const errors = form.formState.errors.lines
  const party = values.customer.mode === 'party' ? values.customer.party : null
  const calcLine = (i: number) => {
    const n = calcIndex.indexOf(i)
    return n >= 0 ? calc?.lines?.[n] : undefined
  }
  const unitDecimals = (id: string) => units.data?.find((u) => String(u.id) === id)?.decimals ?? 3
  const activeLocations = (locations.data ?? []).filter((l) => l.is_active !== false)

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
              aria-invalid={!!errors?.[i]?.item}
              value={field.value ?? undefined}
              onChange={(item) => {
                const line = form.getValues(`lines.${i}`)
                form.setValue(
                  `lines.${i}`,
                  {
                    ...line,
                    item,
                    unit_id: String(item.base_unit.id),
                    rate: line.item?.id === item.id ? line.rate : '',
                  },
                  { shouldValidate: form.formState.isSubmitted },
                )
                // Move on to the next cell, as Enter would (design §7).
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
        const item = values.lines[i]?.item
        return (
          <NativeSelect
            aria-label={`Line ${i + 1} unit`}
            aria-invalid={!!errors?.[i]?.unit_id}
            disabled={!item}
            {...form.register(`lines.${i}.unit_id`)}
          >
            {!item && <option value="">—</option>}
            {(item?.units?.length
              ? item.units
              : item
                ? [{ unit_id: item.base_unit.id, symbol: item.base_unit.symbol }]
                : []
            ).map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.symbol}
              </option>
            ))}
          </NativeSelect>
        )
      },
    },
    ...(isCash
      ? [
          {
            id: 'location',
            header: 'From',
            label: 'Take stock from',
            width: '9rem',
            render: (i: number) => {
              const item = values.lines[i]?.item
              return (
                <NativeSelect
                  aria-label={`Line ${i + 1} location`}
                  aria-invalid={!!errors?.[i]?.location_id}
                  {...form.register(`lines.${i}.location_id`)}
                >
                  <option value="">Choose</option>
                  {activeLocations.map((l) => {
                    const s = item?.stock?.find((x) => x.location_id === l.id)
                    return (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {s ? ` (${qty(s.qty, item?.base_unit.decimals)})` : ''}
                      </option>
                    )
                  })}
                </NativeSelect>
              )
            },
          } satisfies LineColumn,
        ]
      : []),
    {
      id: 'qty',
      header: 'Qty',
      label: 'Quantity',
      width: '7rem',
      align: 'right',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.qty`}
          render={({ field }) => (
            <DecimalInput
              ref={field.ref}
              aria-label={`Line ${i + 1} quantity`}
              aria-invalid={!!errors?.[i]?.qty}
              decimals={unitDecimals(values.lines[i]?.unit_id ?? '')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      ),
    },
    {
      id: 'rate',
      header: 'Rate ₹',
      label: 'Rate ₹ (before GST)',
      width: '8rem',
      align: 'right',
      render: (i) => (
        <Controller
          control={form.control}
          name={`lines.${i}.rate`}
          render={({ field }) => (
            <DecimalInput
              ref={field.ref}
              aria-label={`Line ${i + 1} rate`}
              aria-invalid={!!errors?.[i]?.rate}
              decimals={2}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      ),
    },
    {
      id: 'discount',
      header: 'Disc.',
      label: 'Discount',
      width: '8rem',
      align: 'right',
      render: (i) => (
        <div className="flex gap-1">
          <Controller
            control={form.control}
            name={`lines.${i}.discount`}
            render={({ field }) => (
              <DecimalInput
                ref={field.ref}
                aria-label={`Line ${i + 1} discount`}
                aria-invalid={!!errors?.[i]?.discount}
                decimals={2}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <NativeSelect
            aria-label={`Line ${i + 1} discount type`}
            data-enter-skip
            className="w-14 shrink-0 px-1"
            {...form.register(`lines.${i}.discount_kind`)}
          >
            <option value="pct">%</option>
            <option value="amt">₹</option>
          </NativeSelect>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount ₹',
      label: 'Amount',
      width: '8rem',
      align: 'right',
      desktopOnly: true,
      render: (i) => (
        <span className="inline-block pt-1.5">
          <Money value={calcLine(i)?.line_total} />
        </span>
      ),
    },
  ]

  return (
    <LineGrid
      label="Bill lines"
      count={fields.length}
      rowKey={(i) => fields[i]!.fid}
      columns={columns}
      onAdd={() =>
        append(emptyLine(isCash ? defaultLocationId : undefined), { shouldFocus: false })
      }
      onRemove={(i) =>
        fields.length > 1
          ? remove(i)
          : form.setValue(`lines.${i}`, emptyLine(isCash ? defaultLocationId : undefined))
      }
      rowTone={(i) => (shortages.has(i) ? 'danger' : undefined)}
      rowDetail={(i) => {
        const l = values.lines[i]
        if (!l?.item) return null
        const short = shortages.get(i)
        const e = errors?.[i]
        const message =
          e?.item?.message ??
          e?.unit_id?.message ??
          e?.location_id?.message ??
          e?.qty?.message ??
          e?.rate?.message ??
          e?.discount?.message
        return (
          <span className="grid gap-0.5">
            {short && (
              <span className="flex items-center gap-1 font-medium text-danger">
                <AlertTriangle className="size-3.5" aria-hidden />
                Only {qty(short.available, l.item.base_unit.decimals)} {short.unit} at{' '}
                {short.location_name}; this bill needs{' '}
                {qty(short.required, l.item.base_unit.decimals)} {short.unit}.
              </span>
            )}
            {message && <span className="text-danger">{message}</span>}
            <span className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>
                Stock{!isCash && ' (for information)'}:{' '}
                <StockByLocation
                  stock={l.item.stock}
                  decimals={l.item.base_unit.decimals}
                  highlightLocationId={isCash && l.location_id ? Number(l.location_id) : undefined}
                />
              </span>
              <PriceHints
                itemId={l.item.id}
                unitId={l.unit_id ? Number(l.unit_id) : undefined}
                partyId={party?.id}
                partyName={party?.name}
              />
            </span>
          </span>
        )
      }}
      summary={(i) => {
        const l = values.lines[i]!
        const unit =
          l.item?.units?.find((u) => String(u.unit_id) === l.unit_id)?.symbol ??
          l.item?.base_unit.symbol
        const loc = activeLocations.find((x) => String(x.id) === l.location_id)?.name
        return {
          title: l.item?.name ?? <span className="text-ink-muted">Choose an item</span>,
          detail: l.item
            ? `${l.qty || '—'} ${unit ?? ''} × ₹ ${l.rate || '—'}${isCash && loc ? ` · ${loc}` : ''}`
            : undefined,
          value: <Money value={calcLine(i)?.line_total} />,
        }
      }}
      addLabel="Add item"
    />
  )
}
