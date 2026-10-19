import type { components } from '@/lib/api/schema'
import { billFrom, type Source } from './calc'
import * as data from './data'

type S = components['schemas']

/**
 * In-memory "server" for the demo mode (npm run demo). It starts from the test fixtures,
 * adds a little more shop data, and changes as you use the app until the page reloads.
 * This is mock code: it does plain number maths, which the app itself never does (D-07).
 */

const unit = (id: number) => data.units.find((u) => u.id === id)!
const stock = (shop: string, g1: string, g2: string): S['StockByLocation'][] => [
  { location_id: 1, location_name: 'Shop', qty: shop },
  { location_id: 2, location_name: 'Godown 1', qty: g1 },
  { location_id: 3, location_name: 'Godown 2', qty: g2 },
]

const moreItems: S['Item'][] = [
  {
    id: 42,
    category_id: 2,
    category_name: 'Steel',
    name: 'JSW 8 mm',
    attributes: { brand: 'JSW', size: 8 },
    hsn_code: '7214',
    gst_rate: '18',
    base_unit: unit(2),
    units: [
      { unit_id: 2, symbol: 'kg', factor_to_base: '1.0000' },
      { unit_id: 3, symbol: 'ton', factor_to_base: '1000.0000' },
    ],
    reorder_level: '500.000',
    avg_cost: '63.2000',
    last_purchase_rate: '63.5000',
    is_active: true,
    stock_total: '2340.000',
    stock: stock('340.000', '1200.000', '800.000'),
    stock_value: '147888.00',
    stock_status: 'ok',
  },
  {
    id: 14,
    category_id: 1,
    category_name: 'Cement',
    name: 'Ramco PPC',
    attributes: { brand: 'Ramco', grade: 'PPC' },
    hsn_code: '2523',
    gst_rate: '28',
    base_unit: unit(1),
    units: [{ unit_id: 1, symbol: 'bag', factor_to_base: '1.0000' }],
    reorder_level: '50.000',
    avg_cost: '355.0000',
    is_active: true,
    stock_total: '310.000',
    stock: stock('60.000', '250.000', '0.000'),
    stock_value: '110050.00',
    stock_status: 'ok',
  },
  {
    id: 51,
    category_id: 3,
    category_name: 'Nails',
    name: '2 inch',
    attributes: { size: '2 inch' },
    hsn_code: '7317',
    gst_rate: '18',
    base_unit: unit(2),
    units: [{ unit_id: 2, symbol: 'kg', factor_to_base: '1.0000' }],
    reorder_level: '20.000',
    avg_cost: '92.0000',
    is_active: true,
    stock_total: '64.500',
    stock: stock('24.500', '40.000', '0.000'),
    stock_value: '5934.00',
    stock_status: 'ok',
  },
]

const moreParties: S['Party'][] = [
  {
    id: 10,
    kind: 'customer',
    name: 'Shree Constructions',
    mobile: '9900123456',
    gstin: '29AACCS4321K1Z3',
    state_code: '29',
    credit_limit: '300000.00',
    opening_balance: '0.00',
    balance: '140000.00',
    sites: [{ id: 2, label: 'Hebbal tower', address: 'Survey 44, Hebbal' }],
    is_active: true,
  },
  {
    id: 11,
    kind: 'customer',
    name: 'Anand Interiors',
    mobile: '9845566778',
    state_code: '29',
    opening_balance: '0.00',
    balance: '0.00',
    sites: [],
    is_active: true,
  },
  {
    id: 12,
    kind: 'supplier',
    name: 'UltraTech Cement Depot',
    mobile: '9886001122',
    gstin: '29AAACU1234L1Z8',
    state_code: '29',
    opening_balance: '0.00',
    balance: '-62000.00',
    sites: [],
    is_active: true,
  },
]

function today(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}

export const db = {
  me: structuredClone(data.superAdmin) as S['Me'],
  users: [
    {
      id: data.superAdmin.id,
      full_name: data.superAdmin.full_name,
      email: data.superAdmin.email,
      role: 'super_admin',
      is_active: true,
      last_login_at: new Date().toISOString(),
    },
    {
      id: data.admin.id,
      full_name: data.admin.full_name,
      email: data.admin.email,
      role: 'admin',
      is_active: true,
      last_login_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      full_name: 'Old Clerk',
      email: 'old@shop.test',
      role: 'admin',
      is_active: false,
    },
  ] as S['User'][],
  settings: structuredClone(data.settings) as S['Settings'],
  tallyMapping: {
    sales_ledger_cash: 'Sales - Cash',
    sales_ledger_account: 'Sales - Account',
    cgst_ledger: 'Output CGST',
    sgst_ledger: 'Output SGST',
    igst_ledger: 'Output IGST',
    round_off_ledger: 'Round Off',
  } as S['TallyMapping'],
  locations: structuredClone(data.locations),
  units: structuredClone(data.units),
  categories: structuredClone(data.categories),
  items: [...structuredClone(data.items), ...moreItems],
  parties: [...structuredClone(data.parties), ...moreParties],
  bills: [] as S['Bill'][],
  revisions: new Map<number, S['BillRevision'][]>(),
  payments: [] as S['Payment'][],
  returns: [] as S['CreditNote'][],
  purchases: [] as S['Purchase'][],
  transfers: [] as S['Transfer'][],
  adjustments: [] as S['Adjustment'][],
  notifications: [] as S['Notification'][],
  audit: [] as S['AuditEntry'][],
  syncs: [] as S['TallySync'][],
  seq: {
    bill: 1060,
    cash: 418,
    account: 107,
    payment: 310,
    receipt: 102,
    cn: 9,
    purchase: 31,
    transfer: 12,
    adjustment: 3,
    party: 20,
    item: 60,
    misc: 100,
  },
}

export const source = (): Source => db

// A few days of trading, so lists and the dashboard have something in them.
const seedBills: [number, S['BillInput'], Partial<S['Bill']>][] = [
  [
    3,
    {
      bill_type: 'cash',
      status: 'active',
      customer: { party_id: 7, gstin: '29ABCDE1234F1Z5' },
      place_of_supply: '29',
      vehicle_no: 'KA05AB1234',
      lines: [
        { item_id: 41, location_id: 2, qty: '1.5', unit_id: 3, rate: '68500' },
        { item_id: 12, location_id: 2, qty: '50', unit_id: 1, rate: '395' },
      ],
      payments: [{ mode: 'upi', amount: '50000', reference: 'UPI/628401' }],
    },
    {
      einvoice: {
        status: 'generated',
        irn: '9b3c1f8e2d7a4b6c',
        ack_no: '112410023456',
        ack_date: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    },
  ],
  [
    2,
    {
      bill_type: 'cash',
      status: 'active',
      customer: { walk_in_name: 'Mahesh' },
      place_of_supply: '29',
      lines: [{ item_id: 14, location_id: 1, qty: '10', unit_id: 1, rate: '390' }],
      payments: [{ mode: 'cash', amount: '4992' }],
    },
    {},
  ],
  [
    1,
    {
      bill_type: 'cash',
      status: 'active',
      customer: { party_id: 10 },
      place_of_supply: '29',
      lines: [
        { item_id: 42, location_id: 1, qty: '300', unit_id: 2, rate: '70' },
        { item_id: 51, location_id: 1, qty: '12', unit_id: 2, rate: '120' },
      ],
    },
    { einvoice: { status: 'failed', last_error: 'GSTIN not active on the portal (demo)' } },
  ],
  [
    0,
    {
      bill_type: 'account',
      status: 'active',
      customer: { party_id: 7 },
      place_of_supply: '29',
      lines: [{ item_id: 41, location_id: null, qty: '500', unit_id: 2, rate: '69' }],
      payments: [{ mode: 'bank_transfer', amount: '40710', reference: 'UTR 4521' }],
    },
    { einvoice: { status: 'pending' } },
  ],
  [
    0,
    {
      bill_type: 'cash',
      status: 'draft',
      customer: { party_id: 11 },
      place_of_supply: '29',
      lines: [{ item_id: 51, location_id: 1, qty: '5', unit_id: 2, rate: '118' }],
    },
    {},
  ],
]

for (const [age, input, over] of seedBills) {
  const id = ++db.seq.bill
  const draft = input.status === 'draft'
  const no = draft
    ? null
    : input.bill_type === 'cash'
      ? `C/26-27/${String(++db.seq.cash).padStart(4, '0')}`
      : `A/26-27/${String(++db.seq.account).padStart(4, '0')}`
  const b = billFrom(
    { ...input, bill_date: today(age) },
    { id, bill_no: no, created_at: new Date(Date.now() - age * 86_400_000).toISOString(), ...over },
    source(),
  )
  b.lines = b.lines.map((l, i) => ({ ...l, id: id * 10 + i }))
  b.allowed_actions = actionsFor(b)
  db.bills.unshift(b)
}

db.payments.push(
  {
    id: ++db.seq.payment,
    doc_no: 'R/26-27/0102',
    direction: 'received',
    party_id: 7,
    party_name: 'Ravi Builders',
    pay_date: today(3),
    mode: 'upi',
    amount: '50000.00',
    reference: 'UPI/628401',
    status: 'active',
    allocations: [
      {
        ref_type: 'cash_bill',
        ref_id: db.bills.at(-1)!.id,
        ref_no: db.bills.at(-1)!.bill_no ?? '',
        amount: '50000.00',
      },
    ],
    unallocated: '0.00',
  },
  {
    id: ++db.seq.payment,
    doc_no: 'R/26-27/0101',
    direction: 'received',
    party_id: 10,
    party_name: 'Shree Constructions',
    pay_date: today(5),
    mode: 'cheque',
    amount: '20000.00',
    cheque_no: '004512',
    bank_name: 'Canara Bank',
    cheque_date: today(5),
    cheque_status: 'pending',
    status: 'active',
    allocations: [],
    unallocated: '20000.00',
  },
)

db.returns.push({
  id: 55,
  cn_no: null,
  cn_date: today(1),
  bill_id: db.bills.at(-1)!.id,
  bill_no: db.bills.at(-1)!.bill_no ?? '',
  party_name: 'Ravi Builders',
  status: 'pending',
  reason: 'Excess bags returned from site',
  settlement: 'adjust_ledger',
  created_by_name: 'Suresh B',
  lines: [
    {
      bill_line_id: db.bills.at(-1)!.lines[1]!.id,
      description: 'UltraTech OPC 53',
      qty: '5.000',
      unit: 'bag',
      rate: '395.00',
      taxable_value: '1975.00',
      restock: true,
    },
  ],
  totals: { taxable_total: '1975.00', cgst: '276.50', sgst: '276.50', grand_total: '2528.00' },
})

db.purchases.push({
  id: 31,
  doc_no: 'P/26-27/0031',
  supplier_id: 8,
  supplier_name: 'Jindal Steel Traders',
  supplier_invoice_no: 'JST/1042',
  supplier_invoice_dt: today(6),
  received_date: today(6),
  location_id: 2,
  location_name: 'Godown 1',
  status: 'active',
  lines: [
    {
      id: 701,
      item_id: 41,
      item_name: 'JSW 12 mm',
      location_id: 2,
      qty: '2000.000',
      unit: 'kg',
      base_qty: '2000.000',
      rate: '61.7500',
      taxable_value: '123500.00',
      gst_rate: '18',
      landed_unit_cost: '61.9000',
    },
  ],
  totals: { taxable_total: '123500.00', igst: '22230.00', grand_total: '145730.00' },
  balance_payable: '140500.00',
})

db.transfers.push({
  id: 12,
  doc_no: 'T/26-27/0012',
  transfer_date: today(4),
  from_location_id: 2,
  to_location_id: 1,
  created_by_name: 'Suresh B',
  lines: [{ item_id: 41, item_name: 'JSW 12 mm', base_qty: '500.000', unit: 'kg' }],
})
db.adjustments.push({
  id: 3,
  doc_no: 'ADJ/26-27/0003',
  adj_date: today(2),
  location_id: 1,
  reason: 'breakage',
  notes: 'Bags torn while unloading',
  created_by_name: 'Suresh B',
  lines: [{ item_id: 12, item_name: 'UltraTech OPC 53', qty_change: '-2.000' }],
})

db.notifications.push(
  {
    id: 1,
    kind: 'einv_failed',
    title: `E-invoice failed for ${db.bills[2]?.bill_no}`,
    body: 'GSTIN not active on the portal (demo)',
    ref_type: 'bill',
    ref_id: db.bills[2]?.id,
    is_read: false,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 2,
    kind: 'return_pending',
    title: 'Return waiting for approval',
    body: 'Suresh B returned 5 bags of UltraTech OPC 53',
    ref_type: 'credit_note',
    ref_id: 55,
    is_read: false,
    created_at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
  },
  {
    id: 3,
    kind: 'low_stock',
    title: 'UltraTech OPC 53 is below its reorder level',
    body: '40 bags left; reorder at 50',
    item_id: 12,
    is_read: true,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
)

db.audit.push(
  {
    id: 1,
    user_name: 'Ramesh Kumar',
    action: 'edit',
    entity: 'bill',
    entity_id: db.bills.at(-1)!.id,
    before: { grand_total: '119655.00', version: 1 } as never,
    after: { grand_total: db.bills.at(-1)!.totals.grand_total, version: 2 } as never,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 2,
    user_name: 'Suresh B',
    action: 'create',
    entity: 'party',
    entity_id: 11,
    after: { name: 'Anand Interiors' } as never,
    created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  },
  {
    id: 3,
    user_name: 'Ramesh Kumar',
    action: 'settings',
    entity: 'settings',
    after: { default_charge_gst: '18' } as never,
    created_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  },
)

db.syncs.push({
  id: 1,
  direction: 'export',
  scope: 'masters, sales, receipts',
  period_from: today(40),
  period_to: today(10),
  record_count: 214,
  status: 'succeeded',
  created_by_name: 'Ramesh Kumar',
  created_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
})

/** What the signed-in user may do with this bill (mirrors the server's rules, roughly). */
export function actionsFor(b: S['Bill']): S['Bill']['allowed_actions'] {
  if (b.status !== 'active') return b.status === 'cancelled' ? ['print'] : []
  const sa = db.me.role === 'super_admin'
  const a: S['Bill']['allowed_actions'] = ['print', 'share', 'create_return']
  if (Number(b.totals.balance_due ?? 0) > 0 && b.customer.party_id) a.push('record_payment')
  if (b.bill_type === 'cash' && !b.account_copy) a.push('copy_to_account')
  if (sa) a.push('edit', 'cancel')
  if (b.einvoice.status === 'failed') a.push('generate_einvoice')
  if (sa && b.einvoice.status === 'generated') a.push('cancel_einvoice', 'generate_ewaybill')
  return a
}

export function summarize(b: S['Bill']): S['BillSummary'] {
  const due = Number(b.totals.balance_due ?? 0)
  const paid = Number(b.totals.amount_paid ?? 0)
  return {
    id: b.id,
    bill_type: b.bill_type,
    bill_no: b.bill_no,
    bill_date: b.bill_date,
    status: b.status,
    customer_name: b.customer.name ?? '',
    party_id: b.customer.party_id ?? null,
    grand_total: b.totals.grand_total,
    balance_due: b.totals.balance_due,
    payment_status: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    einvoice_status: b.einvoice.status,
    is_account_copy: !!b.source_bill,
    source_bill_id: b.source_bill?.id ?? null,
    account_copy_id: b.account_copy?.id ?? null,
    version: b.version,
    created_by_name: b.created_by_name,
  }
}

// ---------------------------------------------------------------- persistence (this browser only)
const STORE_KEY = 'demo-db-v1'

/** Saves the demo data so a page refresh keeps what you entered. */
export function saveDb() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...db, revisions: [...db.revisions] }))
  } catch {
    /* storage full or blocked: the demo just forgets on reload */
  }
}

export function resetDb() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}

try {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) {
    const parsed = JSON.parse(saved) as typeof db & { revisions: [number, S['BillRevision'][]][] }
    Object.assign(db, { ...parsed, revisions: new Map(parsed.revisions) })
  }
} catch {
  /* a broken copy is ignored; the seed data is used */
}
