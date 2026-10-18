import { z } from 'zod'
import { toPaymentInput, type PaymentRow } from '@/components/shared/inputs/PaymentSplitEditor'
import type { Item } from '@/features/inventory/api'
import type { Party } from '@/features/parties/api'
import type { components } from '@/lib/api/schema'
import { isZero, MONEY_RE, PERCENT_RE, QTY_RE, todayIST, trimZeros } from '@/lib/format'

type S = components['schemas']
export type BillType = 'cash' | 'account'
export type BillInput = S['BillInput']
export type Bill = S['Bill']

export type LineValues = {
  key: string
  /** The chosen item, kept for display (units, stock); only item_id is sent. */
  item: Item | null
  unit_id: string
  location_id: string
  qty: string
  rate: string
  discount: string
  discount_kind: 'pct' | 'amt'
}

export type ChargeValues = {
  kind: 'labour' | 'transport' | 'other'
  description: string
  amount: string
  gst_rate: string
  sac_code: string
}

export type BillFormValues = {
  bill_type: BillType
  bill_date: string
  customer: {
    mode: 'none' | 'party' | 'walk_in'
    party: Pick<
      Party,
      'id' | 'name' | 'balance' | 'credit_limit' | 'sites' | 'gstin' | 'state_code' | 'mobile'
    > | null
    walk_in_name: string
    gstin: string
    billing_address: string
    mobile: string
    site_address: string
  }
  place_of_supply: string
  vehicle_no: string
  lines: LineValues[]
  charges: ChargeValues[]
  bill_discount: string
  payments: PaymentRow[]
  notes: string
}

let seq = 0
export const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`

export function emptyLine(defaultLocationId: number | undefined): LineValues {
  return {
    key: newKey(),
    item: null,
    unit_id: '',
    location_id: defaultLocationId ? String(defaultLocationId) : '',
    qty: '',
    rate: '',
    discount: '',
    discount_kind: 'pct',
  }
}

export function emptyBill(
  type: BillType,
  shopState: string,
  defaultLocationId: number | undefined,
): BillFormValues {
  return {
    bill_type: type,
    bill_date: todayIST(),
    customer: {
      mode: 'none',
      party: null,
      walk_in_name: '',
      gstin: '',
      billing_address: '',
      mobile: '',
      site_address: '',
    },
    place_of_supply: shopState,
    vehicle_no: '',
    lines: [emptyLine(type === 'cash' ? defaultLocationId : undefined)],
    charges: [],
    bill_discount: '',
    payments: [],
    notes: '',
  }
}

export const isBlankLine = (l: LineValues) => !l.item && !l.qty && !l.rate
export const isCompleteLine = (l: LineValues) =>
  !!l.item && !!l.unit_id && QTY_RE.test(l.qty) && !isZero(l.qty) && MONEY_RE.test(l.rate)

const positive = (re: RegExp, msg: string) =>
  z.string().refine((v) => re.test(v) && !isZero(v), msg)

const lineSchema = z
  .object({
    item: z.unknown(),
    unit_id: z.string(),
    location_id: z.string(),
    qty: z.string(),
    rate: z.string(),
    discount: z.string(),
    discount_kind: z.enum(['pct', 'amt']),
  })
  .passthrough()

/** Save-time checks the browser can make; the server checks the rest (BR-09, FR-AB-03). */
export const billSchema = z
  .object({
    bill_type: z.enum(['cash', 'account']),
    bill_date: z.string().min(1, 'Choose the bill date'),
    customer: z.object({
      mode: z.enum(['none', 'party', 'walk_in']),
      party: z.unknown(),
      walk_in_name: z.string(),
      gstin: z.string(),
      billing_address: z.string(),
      mobile: z.string(),
      site_address: z.string(),
    }),
    place_of_supply: z.string().min(1, 'Choose the place of supply'),
    vehicle_no: z.string(),
    lines: z.array(lineSchema),
    charges: z.array(
      z.object({
        kind: z.enum(['labour', 'transport', 'other']),
        description: z.string(),
        amount: positive(MONEY_RE, 'Enter the amount'),
        gst_rate: z.string(),
        sac_code: z.string(),
      }),
    ),
    bill_discount: z.string().regex(new RegExp(`^$|${MONEY_RE.source}`), 'Enter an amount'),
    payments: z.array(
      z.object({ mode: z.string(), amount: positive(MONEY_RE, 'Enter the amount') }).passthrough(),
    ),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    const c = v.customer
    if (c.mode === 'none')
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'party'],
        message:
          v.bill_type === 'account' ? 'Choose the customer' : 'Choose a customer, or Walk-in',
      })
    if (c.mode === 'walk_in' && !c.walk_in_name.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'walk_in_name'],
        message: 'Enter the walk-in customer’s name',
      })
    if (v.bill_type === 'account' && c.mode !== 'party')
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'party'],
        message: 'Account bills need a named customer',
      })
    const used = v.lines.filter((l) => !isBlankLine(l as LineValues))
    if (used.length === 0)
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Add at least one item' })
    v.lines.forEach((l, i) => {
      const line = l as LineValues
      if (isBlankLine(line)) return
      if (!line.item)
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'item'], message: 'Choose an item' })
      if (!l.unit_id)
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'unit_id'], message: 'Choose a unit' })
      if (!QTY_RE.test(l.qty) || isZero(l.qty))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'qty'], message: 'Enter the quantity' })
      if (!MONEY_RE.test(l.rate))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'rate'], message: 'Enter the rate' })
      if (v.bill_type === 'cash' && !l.location_id)
        ctx.addIssue({
          code: 'custom',
          path: ['lines', i, 'location_id'],
          message: 'Choose the location',
        })
      if (
        l.discount &&
        l.discount_kind === 'pct' &&
        (!PERCENT_RE.test(l.discount) || Number(l.discount) > 100)
      )
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'discount'], message: 'Up to 100%' })
    })
  })

function customerInput(c: BillFormValues['customer'], forCalc: boolean): S['CustomerInput'] {
  const common = {
    gstin: c.gstin || undefined,
    billing_address: c.billing_address || undefined,
    mobile: c.mobile || undefined,
    site_address: c.site_address || undefined,
  }
  if (c.mode === 'party' && c.party) return { party_id: c.party.id, ...common }
  // The calculation needs a customer; a placeholder name is enough for it.
  return { walk_in_name: c.walk_in_name.trim() || (forCalc ? 'Walk-in' : ''), ...common }
}

function lineInput(l: LineValues, type: BillType): S['BillLineInput'] {
  return {
    item_id: l.item!.id,
    location_id: type === 'cash' && l.location_id ? Number(l.location_id) : null,
    qty: l.qty,
    unit_id: Number(l.unit_id),
    rate: l.rate,
    discount_pct: l.discount && l.discount_kind === 'pct' ? l.discount : undefined,
    discount_amt: l.discount && l.discount_kind === 'amt' ? l.discount : undefined,
  }
}

function chargesInput(v: BillFormValues): S['BillChargeInput'][] {
  return v.charges
    .filter((c) => MONEY_RE.test(c.amount) && !isZero(c.amount))
    .map((c) => ({
      kind: c.kind,
      description: c.description || undefined,
      amount: c.amount,
      gst_rate: (c.gst_rate || undefined) as S['GstRate'] | undefined,
      sac_code: c.sac_code || undefined,
    }))
}

/**
 * The save body. Blank lines are dropped; `lineIndex[n]` is the form row of sent line n,
 * so server errors like `lines[1].rate` land on the right row.
 */
export function toBillInput(
  v: BillFormValues,
  status: 'active' | 'draft',
  extra: { expected_total?: string; override_credit_limit?: boolean } = {},
): { body: BillInput; lineIndex: number[] } {
  const lineIndex: number[] = []
  const lines: S['BillLineInput'][] = []
  v.lines.forEach((l, i) => {
    if (isBlankLine(l)) return
    lineIndex.push(i)
    lines.push(lineInput(l, v.bill_type))
  })
  return {
    lineIndex,
    body: {
      bill_type: v.bill_type,
      status,
      bill_date: v.bill_date,
      customer: customerInput(v.customer, false),
      place_of_supply: v.place_of_supply,
      vehicle_no: v.vehicle_no || undefined,
      lines,
      charges: chargesInput(v),
      bill_discount: v.bill_discount || undefined,
      // Drafts take no payments; they are recorded when the bill is saved (server rule).
      payments:
        status === 'active'
          ? v.payments.filter((p) => !isZero(p.amount)).map(toPaymentInput)
          : undefined,
      notes: v.notes || undefined,
      expected_total: extra.expected_total,
      override_credit_limit: extra.override_credit_limit || undefined,
    },
  }
}

/** Body for the live calculation, or null while there is nothing to calculate. */
export function toCalcInput(v: BillFormValues): { body: BillInput; lineIndex: number[] } | null {
  const lineIndex: number[] = []
  const lines: S['BillLineInput'][] = []
  v.lines.forEach((l, i) => {
    if (!isCompleteLine(l)) return
    lineIndex.push(i)
    lines.push(lineInput(l, v.bill_type))
  })
  if (!lines.length || !v.place_of_supply) return null
  if (v.bill_type === 'account' && v.customer.mode !== 'party') return null
  return {
    lineIndex,
    body: {
      bill_type: v.bill_type,
      status: 'active',
      bill_date: v.bill_date,
      customer: customerInput(v.customer, true),
      place_of_supply: v.place_of_supply,
      lines,
      charges: chargesInput(v),
      bill_discount:
        v.bill_discount && MONEY_RE.test(v.bill_discount) ? v.bill_discount : undefined,
      payments: v.payments
        .filter((p) => MONEY_RE.test(p.amount) && !isZero(p.amount))
        .map(toPaymentInput),
    },
  }
}

/** Form values for an existing bill. `items` gives the full item for each line. */
export function fromBill(b: Bill, items: Map<number, Item>): BillFormValues {
  const c = b.customer
  return {
    bill_type: b.bill_type,
    bill_date: b.bill_date,
    customer: {
      mode: c.party_id ? 'party' : 'walk_in',
      party: c.party_id
        ? {
            id: c.party_id,
            name: c.name ?? '',
            balance: '0',
            gstin: c.gstin ?? null,
            mobile: c.mobile ?? null,
            sites: [],
          }
        : null,
      walk_in_name: c.party_id ? '' : (c.name ?? ''),
      gstin: c.gstin ?? '',
      billing_address: c.address ?? '',
      mobile: c.mobile ?? '',
      site_address: c.site_address ?? '',
    },
    place_of_supply: b.place_of_supply ?? '',
    vehicle_no: b.vehicle_no ?? '',
    lines: b.lines.map((l) => ({
      key: newKey(),
      item: l.item_id ? (items.get(l.item_id) ?? null) : null,
      unit_id: l.unit_id ? String(l.unit_id) : '',
      location_id: l.location_id ? String(l.location_id) : '',
      qty: trimZeros(l.qty),
      rate: trimZeros(l.rate),
      discount:
        l.discount_pct && !isZero(l.discount_pct)
          ? trimZeros(l.discount_pct)
          : l.discount_amt && !isZero(l.discount_amt)
            ? trimZeros(l.discount_amt)
            : '',
      discount_kind: l.discount_amt && !isZero(l.discount_amt) ? 'amt' : 'pct',
    })),
    charges: (b.charges ?? []).map((c) => ({
      kind: c.kind ?? 'other',
      description: c.description ?? '',
      amount: trimZeros(c.amount),
      gst_rate: c.gst_rate ?? '',
      sac_code: c.sac_code ?? '',
    })),
    bill_discount:
      b.totals.bill_discount && !isZero(b.totals.bill_discount)
        ? trimZeros(b.totals.bill_discount)
        : '',
    payments: [],
    notes: b.notes ?? '',
  }
}
