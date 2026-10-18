import { describe, expect, it } from 'vitest'
import { categorySchema, codeFromLabel, toCategoryInput } from './category-form'

const base = {
  name: 'Steel',
  parent_id: '',
  default_hsn: '7214',
  default_gst: '18',
  tally_group: '',
  description: '',
  units: [{ unit_id: 2, is_default: true }],
  attributes: [],
}

describe('category form', () => {
  it('derives attribute codes from labels', () => {
    expect(codeFromLabel('Pack size')).toBe('pack_size')
    expect(codeFromLabel(' Size (mm) ')).toBe('size_mm')
    expect(codeFromLabel('12 mm')).toBe('a_12_mm')
  })
  it('needs exactly one default unit', () => {
    expect(categorySchema.safeParse(base).success).toBe(true)
    const none = categorySchema.safeParse({ ...base, units: [{ unit_id: 2, is_default: false }] })
    expect(none.error?.issues[0]?.message).toBe('Mark one unit as the default')
  })
  it('rejects pick-lists with fewer than two options and bad HSN', () => {
    const r = categorySchema.safeParse({
      ...base,
      default_hsn: '72',
      attributes: [
        {
          label: 'Shape',
          code: 'shape',
          data_type: 'select',
          options: 'Round',
          value_unit: '',
          is_required: true,
          part_of_name: true,
        },
      ],
    })
    const messages = r.error?.issues.map((i) => i.message)
    expect(messages).toContain('A pick-list needs at least two options')
    expect(messages).toContain('HSN codes have 4, 6 or 8 digits')
  })
  it('builds the API body with ordered attributes', () => {
    const body = toCategoryInput(
      {
        ...base,
        attributes: [
          {
            label: 'Brand',
            code: 'brand',
            data_type: 'text',
            options: '',
            value_unit: '',
            is_required: true,
            part_of_name: true,
          },
          {
            label: 'Size',
            code: 'size',
            data_type: 'number',
            options: '',
            value_unit: 'mm',
            is_required: true,
            part_of_name: true,
          },
        ],
      } as never,
      true,
    )
    expect(body.attributes?.map((a) => [a.code, a.sort_order, a.value_unit])).toEqual([
      ['brand', 1, null],
      ['size', 2, 'mm'],
    ])
    expect(body.default_gst).toBe('18')
  })
})
