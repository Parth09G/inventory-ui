import * as data from './data'
import type { S } from './types'

/**
 * A stand-in for the server's calculator, good enough to drive the UI: GST 18% on
 * items and charges, CGST/SGST inside the state, rounding to the rupee, stock warnings
 * when a Cash line needs more than its location has.
 */
export function calculate(input: S['BillInput']) {
  const f = (n: number) => n.toFixed(2)
  const interstate = input.place_of_supply !== data.settings.state_code
  const lines = input.lines.map((l, i) => {
    const item = data.items.find((x) => x.id === l.item_id)!
    const factor = Number(item.units?.find((u) => u.unit_id === l.unit_id)?.factor_to_base ?? 1)
    let taxable = Number(l.qty) * Number(l.rate)
    if (l.discount_pct) taxable *= 1 - Number(l.discount_pct) / 100
    if (l.discount_amt) taxable -= Number(l.discount_amt)
    const gst = taxable * 0.18
    return {
      line_no: i + 1,
      item_id: l.item_id,
      location_id: l.location_id,
      description: item.name,
      qty: l.qty,
      unit_id: l.unit_id,
      rate: l.rate,
      base_qty: String(Number(l.qty) * factor),
      taxable_value: f(taxable),
      gst_rate: '18' as const,
      cgst: f(interstate ? 0 : gst / 2),
      sgst: f(interstate ? 0 : gst / 2),
      igst: f(interstate ? gst : 0),
      line_total: f(taxable + gst),
      _base: Number(l.qty) * factor,
      _item: item,
    }
  })
  const charges = (input.charges ?? []).reduce((s, c) => s + Number(c.amount), 0)
  const items = lines.reduce((s, l) => s + Number(l.taxable_value), 0)
  const taxable = items + charges - Number(input.bill_discount ?? 0)
  const tax = taxable * 0.18
  const exact = taxable + tax
  const grand = Math.round(exact)
  const paid = (input.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const stock_warnings: S['ShortLine'][] =
    input.bill_type === 'cash'
      ? lines.flatMap((l) => {
          const at = l._item.stock?.find((s) => s.location_id === l.location_id)
          if (!at || Number(at.qty) >= l._base) return []
          return [
            {
              line_no: l.line_no,
              item_id: l.item_id,
              item_name: l._item.name,
              location_id: l.location_id!,
              location_name: at.location_name,
              required: l._base.toFixed(3),
              available: at.qty,
              unit: l._item.base_unit.symbol,
              available_elsewhere: (l._item.stock ?? [])
                .filter((s) => s.location_id !== l.location_id && Number(s.qty) >= l._base)
                .map((s) => ({
                  location_id: s.location_id,
                  location_name: s.location_name,
                  qty: s.qty,
                })),
            },
          ]
        })
      : []
  return {
    lines: lines.map(({ _base, _item, ...l }) => (void _base, void _item, l)),
    totals: {
      items_taxable: f(items),
      charges_taxable: f(charges),
      bill_discount: f(Number(input.bill_discount ?? 0)),
      taxable_total: f(taxable),
      cgst: f(interstate ? 0 : tax / 2),
      sgst: f(interstate ? 0 : tax / 2),
      igst: f(interstate ? tax : 0),
      tax_by_rate: [
        {
          gst_rate: '18' as const,
          taxable: f(taxable),
          cgst: f(interstate ? 0 : tax / 2),
          sgst: f(interstate ? 0 : tax / 2),
          igst: f(interstate ? tax : 0),
        },
      ],
      round_off: f(grand - exact),
      grand_total: f(grand),
      amount_in_words: `Rupees ${grand} Only`,
      amount_paid: f(paid),
      balance_due: f(grand - paid),
    },
    stock_warnings,
    credit_warning: null,
  }
}

/** A saved bill built from a create/update body, the way the server would return it. */
export function billFrom(input: S['BillInput'], over: Partial<S['Bill']> = {}): S['Bill'] {
  const c = calculate(input)
  const party = data.parties.find((p) => p.id === input.customer.party_id)
  const draft = input.status === 'draft'
  return {
    id: 1052,
    bill_type: input.bill_type,
    bill_no: draft ? null : input.bill_type === 'cash' ? 'C/26-27/0418' : 'A/26-27/0107',
    fy: '26-27',
    bill_date: input.bill_date ?? '2026-10-18',
    status: input.status,
    version: 1,
    customer: {
      party_id: party?.id ?? null,
      name: party?.name ?? input.customer.walk_in_name,
      gstin: party?.gstin ?? null,
      address: party?.billing_address ?? null,
    },
    place_of_supply: input.place_of_supply,
    is_interstate: input.place_of_supply !== '29',
    vehicle_no: input.vehicle_no ?? null,
    affects_stock: input.bill_type === 'cash',
    posts_to_ledger: true,
    lines: c.lines.map((l) => ({
      ...l,
      location_name: data.locations.find((x) => x.id === l.location_id)?.name ?? null,
      unit: data.units.find((u) => u.id === l.unit_id)?.symbol,
      hsn_code: '7214',
    })),
    charges: [],
    totals: c.totals,
    payments: [],
    einvoice: { status: party?.gstin ? 'pending' : 'not_required' },
    allowed_actions: draft
      ? []
      : ['print', 'share', 'record_payment', 'create_return', 'copy_to_account', 'edit', 'cancel'],
    created_by_name: 'Ramesh Kumar',
    ...over,
  }
}
