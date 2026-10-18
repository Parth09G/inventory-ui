import type { S } from './types'

const ALL_PERMISSIONS = [
  'attribute.delete',
  'audit.view',
  'bill.cancel',
  'bill.copy_to_account',
  'bill.create',
  'bill.edit',
  'bill.finalize',
  'bill.print',
  'bill.share',
  'catalogue.manage',
  'category.deactivate',
  'credit_limit.override',
  'dashboard.view',
  'einvoice.cancel',
  'einvoice.credentials',
  'einvoice.generate',
  'item.deactivate',
  'item.manage',
  'location.manage',
  'party.deactivate',
  'party.manage',
  'payment.cancel',
  'payment.cheque_status',
  'payment.create',
  'purchase.cancel',
  'purchase.create',
  'purchase_return.create',
  'reports.export',
  'reports.view',
  'return.approve',
  'return.create',
  'settings.manage',
  'stock.adjust',
  'stock.count',
  'stock.transfer',
  'tally.export',
  'tally.import',
  'user.manage',
]

const SUPER_ADMIN_ONLY = [
  'attribute.delete',
  'audit.view',
  'bill.cancel',
  'bill.edit',
  'category.deactivate',
  'credit_limit.override',
  'einvoice.cancel',
  'einvoice.credentials',
  'item.deactivate',
  'location.manage',
  'party.deactivate',
  'payment.cancel',
  'purchase.cancel',
  'settings.manage',
  'tally.import',
  'user.manage',
]

export const superAdmin: S['Me'] = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Ramesh Kumar',
  email: 'owner@shop.test',
  role: 'super_admin',
  is_active: true,
  permissions: ALL_PERMISSIONS,
}

export const admin: S['Me'] = {
  id: '00000000-0000-4000-8000-000000000002',
  full_name: 'Suresh B',
  email: 'counter@shop.test',
  role: 'admin',
  is_active: true,
  permissions: ALL_PERMISSIONS.filter((p) => !SUPER_ADMIN_ONLY.includes(p)),
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
