import { z } from 'zod'
import { GST_RATES } from '@/components/shared/inputs/GstRateSelect'
import type { Category } from '@/features/catalogue/api'
import { QTY_RE, RATE_RE, trimZeros } from '@/lib/format'
import type { Item, ItemInput } from './api'

export type ItemValues = {
  category_id: string
  attributes: Record<string, string>
  name: string
  hsn_code: string
  gst_rate: string
  base_unit_id: string
  units: { unit_id: string; factor_to_base: string }[]
  reorder_level: string
  sku: string
  opening_stock: { location_id: number; qty: string; unit_cost: string }[]
}

const sortedAttrs = (c: Category | undefined) =>
  [...(c?.attributes ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

/** "12.50" → "12.5": numbers in names are shown the way the server stores them. */
function normaliseNumber(s: string): string {
  return /^\d+(\.\d+)?$/.test(s) ? s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : s
}

/** Same rule as the API: part-of-name attributes in order, number values with their unit. */
export function autoName(category: Category | undefined, attrs: Record<string, string>): string {
  return sortedAttrs(category)
    .filter((a) => a.part_of_name)
    .flatMap((a) => {
      const v = (attrs[a.code] ?? '').trim()
      if (!v) return []
      if (a.data_type === 'number')
        return [normaliseNumber(v) + (a.value_unit ? ` ${a.value_unit}` : '')]
      if (a.data_type === 'select')
        return [a.options?.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v]
      return [v]
    })
    .join(' ')
}

/** Validation that depends on the chosen category's attributes. */
export function itemSchema(category: Category | undefined) {
  return z
    .object({
      category_id: z.string().min(1, 'Choose a category'),
      attributes: z.record(z.string(), z.string()),
      name: z.string().trim(),
      hsn_code: z
        .string()
        .trim()
        .regex(/^(\d{4}|\d{6}|\d{8})$/, 'HSN codes have 4, 6 or 8 digits'),
      gst_rate: z.enum(GST_RATES as [string, ...string[]], { message: 'Choose a GST rate' }),
      base_unit_id: z.string().min(1, 'Choose the base unit'),
      units: z.array(
        z.object({
          unit_id: z.string().min(1, 'Choose a unit'),
          factor_to_base: z
            .string()
            .regex(RATE_RE, 'Enter a number with up to 4 decimals')
            .refine((v) => !/^0*(\.0*)?$/.test(v), 'Must be more than 0'),
        }),
      ),
      reorder_level: z.string().regex(new RegExp(`^$|${QTY_RE.source}`), 'Enter a quantity'),
      sku: z.string().trim(),
      opening_stock: z.array(
        z.object({
          location_id: z.number(),
          qty: z.string().regex(new RegExp(`^$|${QTY_RE.source}`), 'Enter a quantity'),
          unit_cost: z.string().regex(new RegExp(`^$|${RATE_RE.source}`), 'Enter a rate'),
        }),
      ),
    })
    .superRefine((v, ctx) => {
      for (const a of sortedAttrs(category)) {
        const val = (v.attributes[a.code] ?? '').trim()
        const path = ['attributes', a.code]
        if (!val) {
          if (a.is_required)
            ctx.addIssue({ code: 'custom', path, message: `Enter ${a.label.toLowerCase()}` })
        } else if (a.data_type === 'number' && !/^\d+(\.\d+)?$/.test(val)) {
          ctx.addIssue({ code: 'custom', path, message: 'Enter a number' })
        }
      }
      if (!v.name && !autoName(category, v.attributes))
        ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter a name' })
      const seen = new Set([v.base_unit_id])
      v.units.forEach((u, i) => {
        if (seen.has(u.unit_id))
          ctx.addIssue({
            code: 'custom',
            path: ['units', i, 'unit_id'],
            message: 'This unit is already listed',
          })
        seen.add(u.unit_id)
      })
      v.opening_stock.forEach((s, i) => {
        if (s.unit_cost && !s.qty)
          ctx.addIssue({
            code: 'custom',
            path: ['opening_stock', i, 'qty'],
            message: 'Enter the quantity',
          })
      })
    })
}

export function emptyItem(category: Category | undefined, locationIds: number[]): ItemValues {
  const defaultUnit = category?.units?.find((u) => u.is_default)?.unit ?? category?.units?.[0]?.unit
  return {
    category_id: category ? String(category.id) : '',
    attributes: Object.fromEntries(sortedAttrs(category).map((a) => [a.code, ''])),
    name: '',
    hsn_code: category?.default_hsn ?? '',
    gst_rate: category?.default_gst ?? '18',
    base_unit_id: defaultUnit ? String(defaultUnit.id) : '',
    units: [],
    reorder_level: '',
    sku: '',
    opening_stock: locationIds.map((id) => ({ location_id: id, qty: '', unit_cost: '' })),
  }
}

export function fromItem(item: Item, category: Category | undefined): ItemValues {
  const custom = item.name !== autoName(category, stringAttrs(item.attributes))
  return {
    category_id: String(item.category_id),
    attributes: {
      ...Object.fromEntries(sortedAttrs(category).map((a) => [a.code, ''])),
      ...stringAttrs(item.attributes),
    },
    name: custom ? item.name : '',
    hsn_code: item.hsn_code,
    gst_rate: item.gst_rate,
    base_unit_id: String(item.base_unit.id),
    units: (item.units ?? [])
      .filter((u) => u.unit_id !== item.base_unit.id)
      .map((u) => ({ unit_id: String(u.unit_id), factor_to_base: trimZeros(u.factor_to_base) })),
    reorder_level: trimZeros(item.reorder_level),
    sku: item.sku ?? '',
    opening_stock: [],
  }
}

function stringAttrs(a: Item['attributes']): Record<string, string> {
  return Object.fromEntries(Object.entries(a ?? {}).map(([k, v]) => [k, String(v)]))
}

export function toItemInput(v: ItemValues, category: Category | undefined): ItemInput {
  const attributes: Record<string, string | number> = {}
  for (const a of sortedAttrs(category)) {
    const val = (v.attributes[a.code] ?? '').trim()
    if (val) attributes[a.code] = val
  }
  const opening = v.opening_stock
    .filter((s) => s.qty && !/^0*(\.0*)?$/.test(s.qty))
    .map((s) => ({ location_id: s.location_id, qty: s.qty, unit_cost: s.unit_cost || undefined }))
  return {
    category_id: Number(v.category_id),
    attributes,
    name: v.name || undefined,
    hsn_code: v.hsn_code,
    gst_rate: v.gst_rate as ItemInput['gst_rate'],
    base_unit_id: Number(v.base_unit_id),
    units: v.units.map((u) => ({ unit_id: Number(u.unit_id), factor_to_base: u.factor_to_base })),
    reorder_level: v.reorder_level || undefined,
    sku: v.sku || undefined,
    opening_stock: opening.length ? opening : undefined,
  }
}
