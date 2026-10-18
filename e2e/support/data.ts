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
