import { describe, expect, it } from 'vitest'
import type { Category } from '@/features/catalogue/api'
import { autoName, emptyItem, itemSchema, toItemInput } from './item-form'

const steel: Category = {
  id: 2,
  name: 'Steel',
  default_hsn: '7214',
  default_gst: '18',
  is_active: true,
  units: [
    { unit: { id: 2, name: 'Kilogram', symbol: 'kg', decimals: 3 }, is_default: true },
    { unit: { id: 3, name: 'Tonne', symbol: 'ton', decimals: 3 }, is_default: false },
  ],
  attributes: [
    {
      id: 22,
      code: 'size',
      label: 'Size',
      data_type: 'number',
      value_unit: 'mm',
      is_required: true,
      part_of_name: true,
      sort_order: 2,
    },
    {
      id: 21,
      code: 'brand',
      label: 'Brand',
      data_type: 'text',
      is_required: true,
      part_of_name: true,
      sort_order: 1,
    },
    {
      id: 23,
      code: 'grade',
      label: 'Grade',
      data_type: 'select',
      options: ['Fe 500', 'Fe 550'],
      part_of_name: false,
      sort_order: 3,
    },
  ],
}

describe('item form', () => {
  it('builds the automatic name like the server', () => {
    expect(autoName(steel, { brand: 'JSW', size: '12.0', grade: 'Fe 500' })).toBe('JSW 12 mm')
    expect(autoName(steel, { brand: 'JSW', size: '' })).toBe('JSW')
  })
  it('defaults HSN, GST and base unit from the category', () => {
    const v = emptyItem(steel, [1, 2])
    expect(v).toMatchObject({ hsn_code: '7214', gst_rate: '18', base_unit_id: '2' })
    expect(v.opening_stock.map((s) => s.location_id)).toEqual([1, 2])
  })
  it('checks required and number attributes, duplicate units and positive factors', () => {
    const v = {
      ...emptyItem(steel, []),
      attributes: { brand: '', size: 'twelve', grade: '' },
      units: [
        { unit_id: '2', factor_to_base: '1' },
        { unit_id: '3', factor_to_base: '0' },
      ],
    }
    const issues = itemSchema(steel)
      .safeParse(v)
      .error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    expect(issues).toEqual(
      expect.arrayContaining([
        'attributes.brand: Enter brand',
        'attributes.size: Enter a number',
        'units.0.unit_id: This unit is already listed',
        'units.1.factor_to_base: Must be more than 0',
      ]),
    )
  })
  it('sends only filled attributes and opening stock', () => {
    const v = {
      ...emptyItem(steel, [1, 2]),
      attributes: { brand: 'JSW', size: '12', grade: '' },
      units: [{ unit_id: '3', factor_to_base: '1000' }],
      opening_stock: [
        { location_id: 1, qty: '1500', unit_cost: '62.5' },
        { location_id: 2, qty: '', unit_cost: '' },
      ],
    }
    expect(toItemInput(v, steel)).toEqual({
      category_id: 2,
      attributes: { brand: 'JSW', size: '12' },
      name: undefined,
      hsn_code: '7214',
      gst_rate: '18',
      base_unit_id: 2,
      units: [{ unit_id: 3, factor_to_base: '1000' }],
      reorder_level: undefined,
      sku: undefined,
      opening_stock: [{ location_id: 1, qty: '1500', unit_cost: '62.5' }],
    })
  })
})
