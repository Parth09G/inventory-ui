import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Lock, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { FormAlert } from '@/components/shared/FormAlert'
import { GstRateSelect } from '@/components/shared/inputs/GstRateSelect'
import { NativeSelect } from '@/components/shared/inputs/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { categoriesQuery, type Category } from '@/features/catalogue/api'
import { formError } from '@/lib/api/forms'
import { isProblem } from '@/lib/api/problem'
import { locationsQuery, unitsQuery } from '@/lib/api/reference'
import { hasMovementsQuery, useSaveItem, type Item } from './api'
import {
  autoName,
  emptyItem,
  fromItem,
  itemSchema,
  toItemInput,
  type ItemValues,
} from './item-form'

/** Create or edit an item (FR-IN-03, ui-plan #20). */
export function ItemFormPage({
  item,
  initialCategoryId,
}: {
  item?: Item
  initialCategoryId?: number
}) {
  const categories = useQuery(categoriesQuery())
  const [categoryId, setCategoryId] = useState<number | undefined>(
    item?.category_id ?? initialCategoryId,
  )
  const category = categories.data?.find((c) => c.id === categoryId)
  const active = (categories.data ?? []).filter((c) => c.is_active || c.id === categoryId)

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={item ? `Edit ${item.name}` : 'New item'}
        back={
          item ? (
            <Link to="/items/$id" params={{ id: item.id }} className="hover:text-ink">
              {item.name}
            </Link>
          ) : (
            <Link to="/inventory" className="hover:text-ink">
              Inventory
            </Link>
          )
        }
      />
      <div className="mb-4 max-w-sm">
        <Field
          label="Category"
          hint={item ? 'The category cannot change after the item is created.' : undefined}
        >
          <NativeSelect
            value={categoryId ?? ''}
            disabled={!!item}
            autoFocus={!item && !categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Choose a category</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {category && <ItemForm key={category.id} category={category} item={item} />}
    </div>
  )
}

function ItemForm({ category, item }: { category: Category; item?: Item }) {
  const navigate = useNavigate()
  const save = useSaveItem()
  const units = useQuery(unitsQuery())
  const locations = useQuery(locationsQuery())
  const locked = useQuery({ ...hasMovementsQuery(item?.id ?? 0), enabled: !!item }).data === true
  const [alert, setAlert] = useState<string | null>(null)

  const schema = useMemo(() => itemSchema(category), [category])
  const form = useForm<ItemValues>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? fromItem(item, category)
      : emptyItem(
          category,
          (locations.data ?? []).filter((l) => l.is_active !== false).map((l) => l.id),
        ),
  })
  const alt = useFieldArray({ control: form.control, name: 'units' })
  const opening = useFieldArray({ control: form.control, name: 'opening_stock' })
  const e = form.formState.errors
  const values = form.watch()

  const attrs = [...(category.attributes ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const allowedUnits = category.units?.length
    ? category.units.flatMap((u) => (u.unit ? [u.unit] : []))
    : (units.data ?? [])
  const baseUnit = allowedUnits.find((u) => String(u.id) === values.base_unit_id)
  const lockedUnitIds = new Set(item?.units?.map((u) => String(u.unit_id)) ?? [])
  const preview = autoName(category, values.attributes)

  // The name is optional once attributes build one, so re-check it when the built name
  // changes. Only then: a server error on the name (DUPLICATE) must stay until edited.
  const lastPreview = useRef(preview)
  useEffect(() => {
    if (lastPreview.current === preview) return
    lastPreview.current = preview
    if (form.formState.isSubmitted) void form.trigger('name')
  }, [preview, form])

  const onSubmit = form.handleSubmit(async (v) => {
    setAlert(null)
    try {
      const saved = await save.mutateAsync({ id: item?.id, body: toItemInput(v, category) })
      toast.success(item ? `${saved.name} saved` : `${saved.name} added`)
      await navigate({ to: '/items/$id', params: { id: saved.id } })
    } catch (err) {
      setAlert(
        isProblem(err, 'CONFLICT')
          ? err.message
          : formError(err, form.setError, {
              duplicateField: 'name',
              duplicateMessage: 'An item with the same category and attributes already exists',
            }),
      )
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormAlert message={alert} />

      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Description</h2>
        {attrs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {attrs.map((a) => (
              <Field
                key={a.code}
                label={
                  <>
                    {a.label}
                    {a.value_unit && (
                      <span className="font-normal text-ink-muted"> ({a.value_unit})</span>
                    )}
                    {!a.is_required && (
                      <span className="font-normal text-ink-muted"> · optional</span>
                    )}
                  </>
                }
                error={e.attributes?.[a.code]?.message}
              >
                {a.data_type === 'select' ? (
                  <NativeSelect {...form.register(`attributes.${a.code}`)}>
                    <option value="">Choose</option>
                    {a.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    inputMode={a.data_type === 'number' ? 'decimal' : undefined}
                    {...form.register(`attributes.${a.code}`)}
                  />
                )}
              </Field>
            ))}
          </div>
        )}
        <Field
          label="Item name"
          error={e.name?.message}
          hint={preview ? <>Leave blank to use “{preview}”.</> : 'Shown on bills and in searches.'}
        >
          <Input placeholder={preview || undefined} {...form.register('name')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="HSN" error={e.hsn_code?.message}>
            <Input inputMode="numeric" className="code" {...form.register('hsn_code')} />
          </Field>
          <Field label="GST rate" error={e.gst_rate?.message}>
            <GstRateSelect {...form.register('gst_rate')} />
          </Field>
          <Field label="SKU / barcode" hint="Optional">
            <Input className="code" {...form.register('sku')} />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Units</h2>
        {locked && (
          <p className="flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
            This item has stock movements, so its base unit and existing conversions are fixed. Add
            a new unit if you need another conversion.
          </p>
        )}
        <div className="max-w-xs">
          <Field
            label="Base unit"
            error={e.base_unit_id?.message}
            hint="Stock is counted in this unit"
          >
            <NativeSelect disabled={locked} {...form.register('base_unit_id')}>
              <option value="">Choose</option>
              {allowedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {alt.fields.length > 0 && (
          <ul className="grid gap-2" aria-label="Other units">
            {alt.fields.map((f, i) => {
              const fixed = locked && lockedUnitIds.has(f.unit_id)
              return (
                <li key={f.id} className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                  <span className="mt-2 text-ink-muted">1</span>
                  <div className="w-28 sm:w-36">
                    <NativeSelect
                      aria-label={`Unit ${i + 1}`}
                      disabled={fixed}
                      aria-invalid={!!e.units?.[i]?.unit_id}
                      {...form.register(`units.${i}.unit_id`)}
                    >
                      <option value="">Unit</option>
                      {allowedUnits
                        .filter((u) => String(u.id) !== values.base_unit_id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </NativeSelect>
                    {e.units?.[i]?.unit_id && (
                      <p className="mt-1 text-sm text-danger">{e.units[i]?.unit_id?.message}</p>
                    )}
                  </div>
                  <span className="mt-2 text-ink-muted">=</span>
                  <div className="w-24 sm:w-32">
                    <Input
                      aria-label={`Factor for unit ${i + 1}`}
                      inputMode="decimal"
                      className="text-right tabular"
                      disabled={fixed}
                      aria-invalid={!!e.units?.[i]?.factor_to_base}
                      {...form.register(`units.${i}.factor_to_base`)}
                    />
                    {e.units?.[i]?.factor_to_base && (
                      <p className="mt-1 text-sm text-danger">
                        {e.units[i]?.factor_to_base?.message}
                      </p>
                    )}
                  </div>
                  <span className="mt-2 text-ink-muted">{baseUnit?.symbol ?? 'base units'}</span>
                  {!fixed && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove unit ${i + 1}`}
                      onClick={() => alt.remove(i)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => alt.append({ unit_id: '', factor_to_base: '' })}
          >
            <Plus className="size-4" /> Add unit
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Stock</h2>
        <div className="max-w-xs">
          <Field
            label={`Reorder level${baseUnit ? ` (${baseUnit.symbol})` : ''}`}
            error={e.reorder_level?.message}
            hint="Low-stock alert when total stock falls to this"
          >
            <Input
              inputMode="decimal"
              className="text-right tabular"
              {...form.register('reorder_level')}
            />
          </Field>
        </div>
        {!item && opening.fields.length > 0 && (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Opening stock (optional)</p>
            <table className="w-full max-w-lg text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-1 font-medium">Location</th>
                  <th className="pb-1 text-right font-medium">
                    Quantity{baseUnit && ` (${baseUnit.symbol})`}
                  </th>
                  <th className="pb-1 text-right font-medium">
                    Cost per {baseUnit?.symbol ?? 'unit'} ₹
                  </th>
                </tr>
              </thead>
              <tbody>
                {opening.fields.map((f, i) => {
                  const loc = locations.data?.find((l) => l.id === f.location_id)
                  return (
                    <tr key={f.id}>
                      <td className="py-1 pr-2">{loc?.name}</td>
                      <td className="py-1 pr-2">
                        <Input
                          aria-label={`Opening quantity at ${loc?.name}`}
                          inputMode="decimal"
                          className="text-right tabular"
                          aria-invalid={!!e.opening_stock?.[i]?.qty}
                          {...form.register(`opening_stock.${i}.qty`)}
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          aria-label={`Opening cost at ${loc?.name}`}
                          inputMode="decimal"
                          className="text-right tabular"
                          {...form.register(`opening_stock.${i}.unit_cost`)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-sm text-ink-muted">
              Later changes to stock go through purchases or adjustments.
            </p>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {item ? 'Save item' : 'Add item'}
        </Button>
      </div>
    </form>
  )
}
