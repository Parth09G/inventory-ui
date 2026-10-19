import { z } from 'zod'
import { toPaymentInput, type PaymentRow } from '@/components/shared/inputs/PaymentSplitEditor'
import type { Item } from '@/features/inventory/api'
import type { Party } from '@/features/parties/api'
import { isZero, MONEY_RE, QTY_RE, RATE_RE, todayIST } from '@/lib/format'
import type { PurchaseInput } from './api'

export type PurchaseLine = {
  key: string
  item: Item | null
  unit_id: string
  location_id: string
  qty: string
  rate: string
  discount_amt: string
  gst_rate: string
}

export type PurchaseValues = {
  supplier: Pick<Party, 'id' | 'name' | 'state_code'> | null
  supplier_invoice_no: string
  supplier_invoice_dt: string
  received_date: string
  location_id: string
  is_interstate: boolean
  freight: string
  other_charges: string
  lines: PurchaseLine[]
  pay_now: boolean
  payment: PaymentRow[]
  notes: string
}

let seq = 0
export const emptyPurchaseLine = (locationId = ''): PurchaseLine => ({
  key: `p${Date.now().toString(36)}${(seq++).toString(36)}`,
  item: null,
  unit_id: '',
  location_id: locationId,
  qty: '',
  rate: '',
  discount_amt: '',
  gst_rate: '',
})

export const isBlankPurchaseLine = (l: PurchaseLine) => !l.item && !l.qty && !l.rate

const optional = (re: RegExp, msg: string) => z.string().regex(new RegExp(`^$|${re.source}`), msg)

export const purchaseSchema = z
  .object({
    supplier: z.custom<PurchaseValues['supplier']>(),
    supplier_invoice_no: z.string().trim().min(1, 'Enter the dealer’s invoice number'),
    supplier_invoice_dt: z.string().min(1, 'Enter the invoice date'),
    received_date: z.string(),
    location_id: z.string().min(1, 'Choose where the goods were received'),
    is_interstate: z.boolean(),
    freight: optional(MONEY_RE, 'Enter an amount'),
    other_charges: optional(MONEY_RE, 'Enter an amount'),
    lines: z.array(z.custom<PurchaseLine>()),
    pay_now: z.boolean(),
    payment: z.array(z.custom<PaymentRow>()),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.supplier)
      ctx.addIssue({ code: 'custom', path: ['supplier'], message: 'Choose the dealer' })
    const used = v.lines.filter((l) => !isBlankPurchaseLine(l))
    if (!used.length)
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Add at least one item' })
    v.lines.forEach((l, i) => {
      if (isBlankPurchaseLine(l)) return
      if (!l.item)
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'item'], message: 'Choose an item' })
      if (!QTY_RE.test(l.qty) || isZero(l.qty))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'qty'], message: 'Enter the quantity' })
      if (!RATE_RE.test(l.rate))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'rate'], message: 'Enter the rate' })
      if (l.discount_amt && !MONEY_RE.test(l.discount_amt))
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'discount_amt'],
          message: 'Enter an amount',
        })
    })
    const p = v.payment[0]
    if (v.pay_now && (!p || !MONEY_RE.test(p.amount) || isZero(p.amount)))
      ctx.addIssue({
        code: 'custom',
        path: ['payment', 0, 'amount'],
        message: 'Enter the amount paid',
      })
  })

export function emptyPurchase(defaultLocationId: string, firstItem?: Item): PurchaseValues {
  const line = emptyPurchaseLine(defaultLocationId)
  if (firstItem)
    Object.assign(line, {
      item: firstItem,
      unit_id: String(firstItem.base_unit.id),
      gst_rate: firstItem.gst_rate,
    })
  return {
    supplier: null,
    supplier_invoice_no: '',
    supplier_invoice_dt: todayIST(),
    received_date: todayIST(),
    location_id: defaultLocationId,
    is_interstate: false,
    freight: '',
    other_charges: '',
    lines: [line],
    pay_now: false,
    payment: [
      {
        mode: 'bank_transfer',
        amount: '',
        reference: '',
        cheque_no: '',
        cheque_date: '',
        bank_name: '',
      },
    ],
    notes: '',
  }
}

/** Save body; `lineIndex[n]` is the form row of sent line n (for server field errors). */
export function toPurchaseInput(v: PurchaseValues): { body: PurchaseInput; lineIndex: number[] } {
  const lineIndex: number[] = []
  const lines: PurchaseInput['lines'] = []
  v.lines.forEach((l, i) => {
    if (isBlankPurchaseLine(l)) return
    lineIndex.push(i)
    lines.push({
      item_id: l.item!.id,
      location_id:
        l.location_id && l.location_id !== v.location_id ? Number(l.location_id) : undefined,
      qty: l.qty,
      unit_id: Number(l.unit_id),
      rate: l.rate,
      discount_amt: l.discount_amt || undefined,
      gst_rate: (l.gst_rate || undefined) as PurchaseInput['lines'][number]['gst_rate'],
    })
  })
  return {
    lineIndex,
    body: {
      supplier_id: v.supplier!.id,
      supplier_invoice_no: v.supplier_invoice_no.trim(),
      supplier_invoice_dt: v.supplier_invoice_dt,
      received_date: v.received_date || undefined,
      location_id: Number(v.location_id),
      is_interstate: v.is_interstate || undefined,
      freight: v.freight || undefined,
      other_charges: v.other_charges || undefined,
      lines,
      payment: v.pay_now ? toPaymentInput(v.payment[0]!) : undefined,
      notes: v.notes || undefined,
    },
  }
}
