import { describe, expect, it } from 'vitest'
import type { Item } from '@/features/inventory/api'
import {
  billSchema,
  emptyBill,
  emptyLine,
  toBillInput,
  toCalcInput,
  type BillFormValues,
} from './bill-form'

const item = {
  id: 41,
  name: 'JSW 12 mm',
  base_unit: { id: 2, name: 'Kilogram', symbol: 'kg', decimals: 3 },
} as Item

function bill(over: Partial<BillFormValues> = {}): BillFormValues {
  return { ...emptyBill('cash', '29', 1), ...over }
}
const line = (over = {}) => ({
  ...emptyLine(1),
  item,
  unit_id: '2',
  qty: '500',
  rate: '68.50',
  ...over,
})

describe('bill form', () => {
  it('drops blank lines and maps sent lines back to form rows', () => {
    const v = bill({
      customer: { ...bill().customer, mode: 'walk_in', walk_in_name: 'Mahesh' },
      lines: [emptyLine(1), line(), emptyLine(1), line({ discount: '2' })],
      payments: [
        {
          mode: 'upi',
          amount: '34250',
          reference: 'UPI/1',
          cheque_no: '',
          cheque_date: '',
          bank_name: '',
        },
      ],
    })
    const { body, lineIndex } = toBillInput(v, 'active', { expected_total: '34250.00' })
    expect(lineIndex).toEqual([1, 3])
    expect(body.lines).toEqual([
      {
        item_id: 41,
        location_id: 1,
        qty: '500',
        unit_id: 2,
        rate: '68.50',
        discount_pct: undefined,
        discount_amt: undefined,
      },
      {
        item_id: 41,
        location_id: 1,
        qty: '500',
        unit_id: 2,
        rate: '68.50',
        discount_pct: '2',
        discount_amt: undefined,
      },
    ])
    expect(body.customer).toEqual({ walk_in_name: 'Mahesh' })
    expect(body.payments).toEqual([{ mode: 'upi', amount: '34250', reference: 'UPI/1' }])
    expect(body.expected_total).toBe('34250.00')
  })
  it('drafts carry no payments; account bills send no location', () => {
    const v = bill({
      bill_type: 'account',
      customer: { ...bill().customer, mode: 'party', party: { id: 7, name: 'Ravi', balance: '0' } },
      lines: [line()],
      payments: [
        {
          mode: 'upi',
          amount: '100',
          reference: '',
          cheque_no: '',
          cheque_date: '',
          bank_name: '',
        },
      ],
    })
    const { body } = toBillInput(v, 'draft')
    expect(body.payments).toBeUndefined()
    expect(body.lines[0]!.location_id).toBeNull()
    expect(body.customer).toEqual({ party_id: 7 })
  })
  it('calculates only complete lines, and waits for a customer on Account bills', () => {
    const v = bill({ lines: [line(), line({ rate: '' }), emptyLine(1)] })
    const calc = toCalcInput(v)!
    expect(calc.lineIndex).toEqual([0])
    expect(calc.body.customer).toEqual({ walk_in_name: 'Walk-in' })
    expect(toCalcInput(bill({ lines: [emptyLine(1)] }))).toBeNull()
    expect(toCalcInput(bill({ bill_type: 'account', lines: [line()] }))).toBeNull()
  })
  it('validates customer and lines before saving', () => {
    const r = billSchema.safeParse(bill({ lines: [line({ qty: '0', rate: '' }), emptyLine(1)] }))
    const issues = r.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    expect(issues).toEqual([
      'customer.party: Choose a customer, or Walk-in',
      'lines.0.qty: Enter the quantity',
      'lines.0.rate: Enter the rate',
    ])
    const acc = billSchema.safeParse(bill({ bill_type: 'account', lines: [] }))
    expect(acc.error!.issues.map((i) => i.message)).toContain('Account bills need a named customer')
    expect(acc.error!.issues.map((i) => i.message)).toContain('Add at least one item')
  })
})
