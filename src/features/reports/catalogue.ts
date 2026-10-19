import type { operations } from '@/lib/api/schema'

export type ReportKey = operations['runReport']['parameters']['path']['key']
export type ReportFilter = 'dates' | 'location' | 'category' | 'party'
export type ReportDef = { key: ReportKey; title: string; about: string; filters: ReportFilter[] }

const D: ReportFilter[] = ['dates']

/** The 21 server reports, grouped as accountants look for them (ui-plan #36, PRD 3.12). */
export const REPORT_GROUPS: { title: string; reports: ReportDef[] }[] = [
  {
    title: 'Sales',
    reports: [
      {
        key: 'sales-register',
        title: 'Sales register',
        about: 'Cash and Account bills with tax and payment status (Account copies excluded).',
        filters: [...D, 'location', 'party'],
      },
      {
        key: 'bill-type-register',
        title: 'Bill type register',
        about: 'Cash bills, Account bills and the link between copies and their source.',
        filters: D,
      },
      {
        key: 'item-sales',
        title: 'Item-wise sales',
        about: 'Quantity, value, cost and profit per item.',
        filters: [...D, 'category', 'location'],
      },
      {
        key: 'category-sales',
        title: 'Category-wise sales',
        about: 'Quantity, value, cost and profit per category.',
        filters: [...D, 'location'],
      },
      {
        key: 'profit',
        title: 'Gross profit',
        about: 'Sales less average cost of goods sold.',
        filters: [...D, 'category'],
      },
      {
        key: 'edits-cancellations',
        title: 'Edits and cancellations',
        about: 'Every bill revision and cancellation, with the reason.',
        filters: D,
      },
    ],
  },
  {
    title: 'GST',
    reports: [
      {
        key: 'gst-b2b',
        title: 'B2B invoices',
        about: 'By customer GSTIN, for GSTR-1.',
        filters: D,
      },
      {
        key: 'gst-b2c',
        title: 'B2C invoices',
        about: 'By place of supply and rate, for GSTR-1.',
        filters: D,
      },
      {
        key: 'gst-hsn-summary',
        title: 'HSN summary',
        about: 'Quantity and tax by HSN code.',
        filters: D,
      },
      {
        key: 'gst-credit-notes',
        title: 'Credit notes',
        about: 'Credit notes issued, for GSTR-1.',
        filters: D,
      },
      {
        key: 'einvoice-status',
        title: 'E-invoice status',
        about: 'IRN status of every B2B bill and credit note.',
        filters: D,
      },
      {
        key: 'input-gst',
        title: 'Input GST',
        about: 'Tax paid on purchases, for GSTR-3B.',
        filters: D,
      },
    ],
  },
  {
    title: 'Purchases',
    reports: [
      {
        key: 'purchase-register',
        title: 'Purchase register',
        about: 'By dealer, item and period.',
        filters: [...D, 'location', 'party'],
      },
      {
        key: 'payments-made',
        title: 'Payments made',
        about: 'Payments to dealers by mode and date.',
        filters: [...D, 'party'],
      },
    ],
  },
  {
    title: 'Stock',
    reports: [
      {
        key: 'stock-summary',
        title: 'Stock summary',
        about: 'Opening, in, out, closing and value per location.',
        filters: [...D, 'location', 'category'],
      },
      {
        key: 'stock-movement',
        title: 'Stock movement',
        about: 'Every movement in the period.',
        filters: [...D, 'location', 'category'],
      },
      {
        key: 'transfers',
        title: 'Transfers',
        about: 'Stock moved between the shop and godowns.',
        filters: [...D, 'location'],
      },
      {
        key: 'adjustments',
        title: 'Adjustments',
        about: 'With reasons and users.',
        filters: [...D, 'location'],
      },
    ],
  },
  {
    title: 'Ledger',
    reports: [
      {
        key: 'receivables-ageing',
        title: 'Receivables ageing',
        about: 'Customer dues by 0–30, 31–60, 61–90, 90+ days.',
        filters: ['party'],
      },
      {
        key: 'payables-ageing',
        title: 'Payables ageing',
        about: 'Dealer dues by age.',
        filters: ['party'],
      },
      {
        key: 'collections',
        title: 'Collections',
        about: 'Payments received by mode and date, with cheque status.',
        filters: [...D, 'party'],
      },
    ],
  },
]

export const REPORTS = new Map(
  REPORT_GROUPS.flatMap((g) => g.reports.map((r) => [r.key, r] as const)),
)
