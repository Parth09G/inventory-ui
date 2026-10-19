import type { S } from './types'

// Mirrors commonPermissions / superAdminPermissions in backend-api/api/internal/auth/auth.go.
const COMMON_PERMISSIONS = [
  'dashboard.view',
  'reports.view',
  'reports.export',
  'bill.create',
  'bill.finalize',
  'bill.copy_to_account',
  'bill.print',
  'bill.share',
  'einvoice.generate',
  'payment.create',
  'payment.cheque_status',
  'return.create',
  'purchase.create',
  'purchase_return.create',
  'stock.transfer',
  'stock.adjust',
  'stock.count',
  'catalogue.manage',
  'item.manage',
  'party.manage',
  'tally.export',
]

const SUPER_ADMIN_ONLY = [
  'bill.edit',
  'bill.cancel',
  'einvoice.cancel',
  'credit_limit.override',
  'payment.cancel',
  'return.approve',
  'purchase.cancel',
  'item.deactivate',
  'category.deactivate',
  'attribute.delete',
  'party.deactivate',
  'location.manage',
  'user.manage',
  'settings.manage',
  'einvoice.credentials',
  'tally.import',
  'audit.view',
]

export const superAdmin: S['Me'] = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Ramesh Kumar',
  email: 'owner@shop.test',
  role: 'super_admin',
  is_active: true,
  permissions: [...COMMON_PERMISSIONS, ...SUPER_ADMIN_ONLY],
}

export const admin: S['Me'] = {
  id: '00000000-0000-4000-8000-000000000002',
  full_name: 'Suresh B',
  email: 'counter@shop.test',
  role: 'admin',
  is_active: true,
  permissions: COMMON_PERMISSIONS,
}

export const locations: S['Location'][] = [
  { id: 1, name: 'Shop', kind: 'shop', is_default_billing: true, is_active: true },
  { id: 2, name: 'Godown 1', kind: 'godown', is_active: true },
  { id: 3, name: 'Godown 2', kind: 'godown', is_active: true },
]

export const units: S['Unit'][] = [
  { id: 1, name: 'Bag', symbol: 'bag', uqc_code: 'BAG', decimals: 0 },
  { id: 2, name: 'Kilogram', symbol: 'kg', uqc_code: 'KGS', decimals: 3 },
  { id: 3, name: 'Tonne', symbol: 'ton', uqc_code: 'TON', decimals: 3 },
  { id: 4, name: 'Numbers', symbol: 'nos', uqc_code: 'NOS', decimals: 0 },
  { id: 5, name: 'Litre', symbol: 'ltr', uqc_code: 'LTR', decimals: 3 },
]

export const states = [
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '32', name: 'Kerala' },
]

const unit = (id: number) => units.find((u) => u.id === id)!

export const categories: S['Category'][] = [
  {
    id: 1,
    name: 'Cement',
    default_hsn: '2523',
    default_gst: '18',
    is_active: true,
    item_count: 2,
    units: [{ unit: unit(1), is_default: true }],
    attributes: [
      {
        id: 11,
        code: 'brand',
        label: 'Brand',
        data_type: 'text',
        is_required: true,
        part_of_name: true,
        sort_order: 1,
      },
      {
        id: 12,
        code: 'grade',
        label: 'Grade',
        data_type: 'select',
        options: ['OPC 43', 'OPC 53', 'PPC'],
        is_required: true,
        part_of_name: true,
        sort_order: 2,
      },
    ],
  },
  {
    id: 2,
    name: 'Steel',
    default_hsn: '7214',
    default_gst: '18',
    is_active: true,
    item_count: 2,
    units: [
      { unit: unit(2), is_default: true },
      { unit: unit(3), is_default: false },
    ],
    attributes: [
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
        id: 22,
        code: 'size',
        label: 'Size',
        data_type: 'number',
        value_unit: 'mm',
        is_required: true,
        part_of_name: true,
        sort_order: 2,
      },
    ],
  },
  { id: 3, name: 'Tiles (old)', is_active: false, item_count: 0, units: [], attributes: [] },
]

const stock = (shop: string, g1: string, g2: string): S['StockByLocation'][] => [
  { location_id: 1, location_name: 'Shop', qty: shop },
  { location_id: 2, location_name: 'Godown 1', qty: g1 },
  { location_id: 3, location_name: 'Godown 2', qty: g2 },
]

export const items: S['Item'][] = [
  {
    id: 41,
    category_id: 2,
    category_name: 'Steel',
    name: 'JSW 12 mm',
    attributes: { brand: 'JSW', size: 12 },
    hsn_code: '7214',
    gst_rate: '18',
    base_unit: unit(2),
    units: [
      { unit_id: 2, symbol: 'kg', factor_to_base: '1.0000' },
      { unit_id: 3, symbol: 'ton', factor_to_base: '1000.0000' },
    ],
    reorder_level: '500.000',
    avg_cost: '62.5000',
    last_purchase_rate: '63.0000',
    is_active: true,
    stock_total: '1620.000',
    stock: stock('120.000', '1500.000', '0.000'),
    stock_value: '101250.00',
    stock_status: 'ok',
  },
  {
    id: 12,
    category_id: 1,
    category_name: 'Cement',
    name: 'UltraTech OPC 53',
    attributes: { brand: 'UltraTech', grade: 'OPC 53' },
    hsn_code: '2523',
    gst_rate: '28',
    base_unit: unit(1),
    units: [{ unit_id: 1, symbol: 'bag', factor_to_base: '1.0000' }],
    reorder_level: '50.000',
    avg_cost: '385.0000',
    is_active: true,
    stock_total: '40.000',
    stock: stock('0.000', '40.000', '0.000'),
    stock_value: '15400.00',
    stock_status: 'low',
  },
  {
    id: 13,
    category_id: 1,
    category_name: 'Cement',
    name: 'ACC PPC',
    attributes: { brand: 'ACC', grade: 'PPC' },
    hsn_code: '2523',
    gst_rate: '28',
    base_unit: unit(1),
    units: [{ unit_id: 1, symbol: 'bag', factor_to_base: '1.0000' }],
    reorder_level: '50.000',
    avg_cost: '360.0000',
    is_active: true,
    stock_total: '0.000',
    stock: stock('0.000', '0.000', '0.000'),
    stock_value: '0.00',
    stock_status: 'out',
  },
]

export function page<T>(rows: T[], p = 1, total = rows.length, page_size = 50) {
  return { data: rows, meta: { page: p, page_size, total } }
}

export const parties: S['Party'][] = [
  {
    id: 7,
    kind: 'customer',
    name: 'Ravi Builders',
    mobile: '9845012345',
    gstin: '29ABCDE1234F1Z5',
    state_code: '29',
    billing_address: '14 MG Road, Bengaluru',
    pincode: '560001',
    credit_limit: '200000.00',
    opening_balance: '0.00',
    balance: '98450.00',
    sites: [{ id: 1, label: 'Yelahanka plot', address: 'Plot 21, Yelahanka' }],
    is_active: true,
  },
  {
    id: 8,
    kind: 'supplier',
    name: 'Jindal Steel Traders',
    mobile: '9900011122',
    gstin: '33AAACJ1234K1Z2',
    state_code: '33',
    opening_balance: '-25000.00',
    balance: '-140500.00',
    sites: [],
    is_active: true,
  },
  { id: 9, kind: 'customer', name: 'Walk-in Mahesh', balance: '0.00', sites: [], is_active: true },
]

export const ledger: S['Ledger'] = {
  opening: '0.00',
  closing: '98450.00',
  entries: [
    {
      id: 1,
      date: '2026-10-10',
      ref_type: 'bill',
      ref_id: 1052,
      ref_no: 'C/26-27/0418',
      narration: 'Cash bill',
      debit: '148450.00',
      credit: '0.00',
      balance: '148450.00',
    },
    {
      id: 2,
      date: '2026-10-10',
      ref_type: 'payment',
      ref_id: 301,
      ref_no: 'R/26-27/0102',
      narration: 'UPI UPI/628401',
      debit: '0.00',
      credit: '50000.00',
      balance: '98450.00',
    },
  ],
}

export const settings: S['Settings'] = {
  shop_name: 'Sri Lakshmi Building Materials',
  address: '1 Market Road, Bengaluru 560001',
  state_code: '29',
  gstin: '29AAACS1234A1Z9',
  prices_include_gst: false,
  default_charge_gst: '18',
  einvoice_enabled: true,
}

export const dashboard = {
  summary: {
    period: { from: '2026-10-01', to: '2026-10-19' },
    stock: {
      items: 3,
      value: '116650.00',
      low_count: 1,
      out_count: 1,
      by_location: [
        { location_id: 1, name: 'Shop', value: '7500.00' },
        { location_id: 2, name: 'Godown 1', value: '109150.00' },
        { location_id: 3, name: 'Godown 2', value: '0.00' },
      ],
    },
    sales: {
      today: '8083.00',
      period: '412650.00',
      fy: '3842100.00',
      cash_bills: '298400.00',
      account_bills: '114250.00',
      bill_count: 37,
    },
    gross_profit: '45210.00',
    gross_margin_pct: '12.40',
    receivables: '238450.00',
    payables: '140500.00',
    cheques_pending: '20000.00',
    collections_by_mode: [
      { mode: 'cash', amount: '152300.00' },
      { mode: 'upi', amount: '98450.00' },
      { mode: 'cheque', amount: '20000.00' },
    ],
  } satisfies S['DashboardSummary'],
  pending: {
    einvoice_failed: 1,
    einvoice_pending: 0,
    returns_pending: 2,
    blocked_bills_today: 0,
    tally_unexported: 0,
    cheques_due: 1,
  } satisfies S['PendingWork'],
  trend: Array.from({ length: 19 }, (_, i) => ({
    bucket: `2026-10-${String(i + 1).padStart(2, '0')}`,
    sales: String(12000 + ((i * 7919) % 31000)) + '.00',
    profit: String(1500 + ((i * 3571) % 4200)) + '.00',
    bills: 1 + (i % 4),
  })) satisfies S['TrendPoint'][],
}
