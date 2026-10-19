import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form'
import { DecimalInput } from '@/components/shared/inputs/DecimalInput'
import { ItemPicker } from '@/components/shared/inputs/ItemPicker'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { focusNextCell, LineGrid, type LineColumn } from '@/components/shared/line-grid/LineGrid'
import { StockByLocation } from '@/components/shared/StockByLocation'
import type { Item } from '@/features/inventory/api'
import { useQuery } from '@tanstack/react-query'
import { unitsQuery } from '@/lib/api/reference'
import { isZero, qty as fmtQty, QTY_RE } from '@/lib/format'
import type { ShortLine } from '@/features/billing/api'

export type StockLine = {
  key: string
  item: Item | null
  unit_id: string
  qty: string
  direction: 'in' | 'out'
}
export type StockLinesForm = { lines: StockLine[] }

let seq = 0
export const emptyStockLine = (item?: Item | null): StockLine => ({
  key: `s${Date.now().toString(36)}${(seq++).toString(36)}`,
  item: item ?? null,
  unit_id: item ? String(item.base_unit.id) : '',
  qty: '',
  direction: 'out',
})

export const isBlankStockLine = (l: StockLine) => !l.item && !l.qty
export function stockLineIssues(
  lines: StockLine[],
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = []
  if (!lines.some((l) => !isBlankStockLine(l)))
    issues.push({ path: ['lines'], message: 'Add at least one item' })
  lines.forEach((l, i) => {
    if (isBlankStockLine(l)) return
    if (!l.item) issues.push({ path: ['lines', i, 'item'], message: 'Choose an item' })
    if (!QTY_RE.test(l.qty) || isZero(l.qty))
      issues.push({ path: ['lines', i, 'qty'], message: 'Enter the quantity' })
  })
  return issues
}

type Props = {
  form: UseFormReturn<StockLinesForm>
  label: string
  /** Show this location's stock for each item (the source of a transfer, the counted location). */
  locationId?: number
  /** Adjustments: add or remove, in the item's base unit. */
  signed?: boolean
  shortages?: Map<number, ShortLine>
}

/** Item + unit + quantity lines for transfers and adjustments (D-30). */
export function StockLines({ form, label, locationId, signed, shortages }: Props) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
    keyName: 'fid',
  })
  const units = useQuery(unitsQuery())
  const lines = form.watch('lines')
  const errors = form.formState.errors.lines
  const decimals = (unitId: string) =>
    units.data?.find((u) => String(u.id) === unitId)?.decimals ?? 3

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
                form.setValue(`lines.${i}`, { ...line, item, unit_id: String(item.base_unit.id) })
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
    ...(signed
      ? [
          {
            id: 'direction',
            header: 'Change',
            label: 'Change',
            width: '8rem',
            render: (i: number) => (
              <NativeSelect
                aria-label={`Line ${i + 1} change`}
                {...form.register(`lines.${i}.direction`)}
              >
                <option value="out">Remove</option>
                <option value="in">Add</option>
              </NativeSelect>
            ),
          } satisfies LineColumn,
        ]
      : [
          {
            id: 'unit',
            header: 'Unit',
            label: 'Unit',
            width: '6rem',
            render: (i: number) => {
              const item = lines[i]?.item
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
          } satisfies LineColumn,
        ]),
    {
      id: 'qty',
      header: signed ? 'Qty (base unit)' : 'Qty',
      label: signed ? 'Quantity (base unit)' : 'Quantity',
      width: '8rem',
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
              decimals={decimals(lines[i]?.unit_id ?? '')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ),
    },
  ]

  return (
    <div className="grid gap-1">
      <LineGrid
        label={label}
        count={fields.length}
        rowKey={(i) => fields[i]!.fid}
        columns={columns}
        onAdd={() => append(emptyStockLine(), { shouldFocus: false })}
        onRemove={(i) =>
          fields.length > 1 ? remove(i) : form.setValue(`lines.${i}`, emptyStockLine())
        }
        rowTone={(i) => (shortages?.has(i) ? 'danger' : undefined)}
        rowDetail={(i) => {
          const l = lines[i]
          const msg = errors?.[i]?.item?.message ?? errors?.[i]?.qty?.message
          const short = shortages?.get(i)
          if (!l?.item) return msg ? <span className="text-danger">{msg}</span> : null
          return (
            <span className="flex flex-wrap gap-x-4">
              {msg && <span className="text-danger">{msg}</span>}
              {short && (
                <span className="font-medium text-danger">
                  Only {fmtQty(short.available)} {short.unit} at {short.location_name}
                </span>
              )}
              <span>
                Stock:{' '}
                <StockByLocation
                  stock={l.item.stock}
                  decimals={l.item.base_unit.decimals}
                  highlightLocationId={locationId}
                />
                {signed && <span className="ml-1">({l.item.base_unit.symbol})</span>}
              </span>
            </span>
          )
        }}
        summary={(i) => {
          const l = lines[i]!
          const unit = signed
            ? l.item?.base_unit.symbol
            : l.item?.units?.find((u) => String(u.unit_id) === l.unit_id)?.symbol
          return {
            title: l.item?.name ?? <span className="text-ink-muted">Choose an item</span>,
            detail: l.item
              ? `${signed ? (l.direction === 'in' ? 'Add ' : 'Remove ') : ''}${l.qty || '—'} ${unit ?? ''}`
              : undefined,
          }
        }}
        addLabel="Add item"
      />
      {(errors?.message || errors?.root?.message) && (
        <p className="text-sm text-danger">{errors?.message ?? errors?.root?.message}</p>
      )}
    </div>
  )
}
