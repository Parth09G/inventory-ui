import { z } from 'zod'
import { GST_RATES } from '@/components/shared/inputs/GstRateSelect'
import type { Category, CategoryAttributeInput, CategoryInput } from './api'

export const attributeSchema = z
  .object({
    label: z.string().trim().min(1, 'Enter a label'),
    code: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, digits and _ only, starting with a letter'),
    data_type: z.enum(['text', 'number', 'select']),
    options: z.string(),
    value_unit: z.string().trim(),
    is_required: z.boolean(),
    part_of_name: z.boolean(),
  })
  .refine((a) => a.data_type !== 'select' || splitOptions(a.options).length >= 2, {
    path: ['options'],
    message: 'A pick-list needs at least two options',
  })
export type AttributeValues = z.infer<typeof attributeSchema>

export const categorySchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name'),
    parent_id: z.string(),
    default_hsn: z
      .string()
      .trim()
      .regex(/^(\d{4}|\d{6}|\d{8})?$/, 'HSN codes have 4, 6 or 8 digits'),
    default_gst: z.union([z.enum(GST_RATES as [string, ...string[]]), z.literal('')]),
    tally_group: z.string().trim(),
    description: z.string().trim(),
    units: z
      .array(z.object({ unit_id: z.number(), is_default: z.boolean() }))
      .min(1, 'Choose at least one unit'),
    attributes: z.array(attributeSchema),
  })
  .refine((v) => v.units.filter((u) => u.is_default).length === 1, {
    path: ['units'],
    message: 'Mark one unit as the default',
  })
  .refine((v) => new Set(v.attributes.map((a) => a.code)).size === v.attributes.length, {
    path: ['attributes'],
    message: 'Two attributes have the same code',
  })
export type CategoryValues = z.infer<typeof categorySchema>

export function splitOptions(s: string): string[] {
  return s
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

/** "Pack size" → "pack_size". */
export function codeFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'a_$1')
}

export function toAttributeInput(a: AttributeValues, sort_order: number): CategoryAttributeInput {
  return {
    label: a.label,
    code: a.code,
    data_type: a.data_type,
    options: a.data_type === 'select' ? splitOptions(a.options) : undefined,
    value_unit: a.value_unit || null,
    is_required: a.is_required,
    part_of_name: a.part_of_name,
    sort_order,
  }
}

export function fromAttribute(
  a: Category['attributes'] extends (infer A)[] | undefined ? A : never,
): AttributeValues {
  return {
    label: a.label,
    code: a.code,
    data_type: a.data_type,
    options: (a.options ?? []).join(', '),
    value_unit: a.value_unit ?? '',
    is_required: a.is_required ?? false,
    part_of_name: a.part_of_name ?? false,
  }
}

export function toCategoryInput(v: CategoryValues, withAttributes: boolean): CategoryInput {
  return {
    name: v.name,
    parent_id: v.parent_id ? Number(v.parent_id) : undefined,
    default_hsn: v.default_hsn || undefined,
    default_gst: (v.default_gst || undefined) as CategoryInput['default_gst'],
    tally_group: v.tally_group || undefined,
    description: v.description || undefined,
    units: v.units,
    attributes: withAttributes ? v.attributes.map((a, i) => toAttributeInput(a, i + 1)) : undefined,
  }
}

export function fromCategory(c: Category): CategoryValues {
  return {
    name: c.name,
    parent_id: c.parent_id ? String(c.parent_id) : '',
    default_hsn: c.default_hsn ?? '',
    default_gst: c.default_gst ?? '',
    tally_group: c.tally_group ?? '',
    description: c.description ?? '',
    units: (c.units ?? []).flatMap((u) =>
      u.unit ? [{ unit_id: u.unit.id, is_default: !!u.is_default }] : [],
    ),
    attributes: [...(c.attributes ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(fromAttribute),
  }
}
