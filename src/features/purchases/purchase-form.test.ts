import { describe, expect, it } from 'vitest'
import type { Item } from '@/features/inventory/api'
import { emptyPurchase, emptyPurchaseLine, purchaseSchema, toPurchaseInput } from './purchase-form'

const item = {
  id: 41,
  name: 'JSW 12 mm',
  gst_rate: '18',
  base_unit: { id: 2, name: 'Kilogram', symbol: 'kg', decimals: 3 },
} as Item

describe('purchase form', () => {
  it('sends a per-line location only when it differs from the receiving location', () => {
    const v = emptyPurchase('2', item)
    v.supplier = { id: 8, name: 'Jindal' }
    v.supplier_invoice_no = ' JST/1042 '
    v.lines = [
      { ...v.lines[0]!, qty: '2000', rate: '61.75' },
      emptyPurchaseLine('2'),
      {
        ...emptyPurchaseLine('3'),
        item,
        unit_id: '2',
        qty: '500',
        rate: '61.75',
        discount_amt: '100',
      },
    ]
    const { body, lineIndex } = toPurchaseInput(v)
    expect(lineIndex).toEqual([0, 2])
    expect(body).toMatchObject({
      supplier_id: 8,
      supplier_invoice_no: 'JST/1042',
      location_id: 2,
      payment: undefined,
    })
    expect(body.lines).toEqual([
      {
        item_id: 41,
        location_id: undefined,
        qty: '2000',
        unit_id: 2,
        rate: '61.75',
        discount_amt: undefined,
        gst_rate: '18',
      },
      {
        item_id: 41,
        location_id: 3,
        qty: '500',
        unit_id: 2,
        rate: '61.75',
        discount_amt: '100',
        gst_rate: undefined,
      },
    ])
  })
  it('requires dealer, invoice number, a line, and the amount when paying now', () => {
    const v = { ...emptyPurchase('2'), pay_now: true }
    const issues = purchaseSchema.safeParse(v).error!.issues.map((i) => i.message)
    expect(issues).toEqual(
      expect.arrayContaining([
        'Choose the dealer',
        'Enter the dealer’s invoice number',
        'Add at least one item',
        'Enter the amount paid',
      ]),
    )
  })
})
