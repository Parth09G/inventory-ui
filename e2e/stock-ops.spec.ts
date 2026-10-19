import type { Page } from '@playwright/test'
import { problem } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

const purchase: S['Purchase'] = {
  id: 31,
  doc_no: 'P/26-27/0031',
  supplier_id: 8,
  supplier_name: 'Jindal Steel Traders',
  supplier_invoice_no: 'JST/1042',
  supplier_invoice_dt: '2026-10-17',
  received_date: '2026-10-18',
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
  balance_payable: '145730.00',
}

test.beforeEach(async ({ mock }) => {
  mock
    .on('get', '/settings', data.settings)
    .on('get', '/categories', data.categories)
    .on('get', '/parties', (r) =>
      data.page(
        data.parties.filter((p) =>
          r.query.get('kind') === 'supplier' ? p.kind === 'supplier' : p.kind !== 'supplier',
        ),
      ),
    )
    .on('get', '/parties/{id}', (r) => data.parties.find((p) => p.id === Number(r.params.id))!)
    .on('get', '/items', (r) => {
      const q = (r.query.get('q') ?? '').toLowerCase()
      return data.page(data.items.filter((i) => i.name.toLowerCase().includes(q)))
    })
    .on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
})

/** Grid row on desktop; the line sheet on phone. */
async function fillLine(
  page: Page,
  row: number,
  item: string,
  qty: string,
  label: string,
  extra?: (scope: ReturnType<Page['getByRole']> | Page) => Promise<void>,
) {
  const phone = (page.viewportSize()?.width ?? 1366) < 1024
  const scope = phone ? page.getByRole('dialog', { name: `Line ${row}` }) : page
  if (phone) {
    const cards = page.getByRole('list', { name: label }).getByRole('button')
    if ((await cards.count()) >= row) await cards.nth(row - 1).click()
    else await page.getByRole('button', { name: 'Add item' }).click()
  }
  await scope.getByRole('combobox', { name: `Line ${row} item` }).fill(item)
  await page
    .getByRole('option', { name: new RegExp(item) })
    .first()
    .click()
  await scope.getByLabel(`Line ${row} quantity`).fill(qty)
  await extra?.(scope)
  if (phone) await scope.getByRole('button', { name: 'Done' }).click()
}

test.describe('purchases (#23–#26)', () => {
  test('entry: inter-state dealer, line received elsewhere, duplicate invoice, then saved', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    let first = true
    mock.on('post', '/purchases', () => {
      if (first) return ((first = false), problem(409, 'DUPLICATE'))
      return purchase
    })
    mock.on('get', '/purchases/{id}', purchase)
    await page.goto('/purchases/new')
    await page.getByRole('combobox', { name: 'Dealer' }).fill('Jindal')
    await page.getByRole('option', { name: /Jindal Steel Traders/ }).click()
    await expect(page.getByLabel('Inter-state purchase (IGST)')).toBeChecked()
    await page.getByLabel('Dealer invoice no.').fill('JST/1042')
    await expect(page.getByLabel('Received into', { exact: true })).toHaveValue('2')
    await fillLine(page, 1, 'JSW', '2000', 'Purchase lines', async (s) => {
      await s.getByLabel('Line 1 rate').fill('61.75')
      await s.getByLabel('Line 1 location').selectOption({ label: 'Shop' })
    })
    await page.getByLabel('Freight ₹').fill('300')
    await page.getByRole('button', { name: 'Save purchase' }).click()
    await expect(
      page.getByText('Invoice JST/1042 from Jindal Steel Traders is already entered'),
    ).toBeVisible()
    await page.getByLabel('Dealer invoice no.').fill('JST/1043')
    await page.getByRole('button', { name: 'Save purchase' }).click()
    await expect(page).toHaveURL(/\/purchases\/31$/)
    const req = mock.calls('POST', '/purchases')[1]!
    expect(req.headers['idempotency-key']).toBe(
      mock.calls('POST', '/purchases')[0]!.headers['idempotency-key'],
    )
    expect(req.body).toMatchObject({
      supplier_id: 8,
      supplier_invoice_no: 'JST/1043',
      location_id: 2,
      is_interstate: true,
      freight: '300',
      lines: [
        { item_id: 41, location_id: 1, qty: '2000', unit_id: 2, rate: '61.75', gst_rate: '18' },
      ],
    })
  })

  test('view: Super Admin cancel is refused when stock was sold; return to dealer', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on('get', '/purchases/{id}', purchase)
      .on('post', '/purchases/{id}/cancel', problem(422, 'INSUFFICIENT_STOCK'))
      .on('post', '/purchase-returns', { id: 4, doc_no: 'PR/26-27/0004' })
    await page.goto('/purchases/31')
    await expect(page.getByRole('table', { name: 'Purchase lines' })).toContainText('61.90')
    await page.getByRole('button', { name: 'Cancel purchase' }).click()
    await page.getByLabel('Reason').fill('Wrong dealer')
    await page.getByRole('button', { name: 'Cancel purchase' }).last().click()
    await expect(page.getByText('Some of this stock has already been sold')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: 'Return to dealer' }).click()
    await page.getByLabel('Return quantity for JSW 12 mm').fill('100')
    await page.getByLabel('Reason').fill('Rusted bars')
    await page.getByRole('button', { name: 'Save return' }).click()
    await expect(page.getByText('Purchase return PR/26-27/0004 saved')).toBeVisible()
    expect(mock.calls('POST', '/purchase-returns')[0]!.body).toMatchObject({
      purchase_id: 31,
      reason: 'Rusted bars',
      lines: [{ purchase_line_id: 701, qty: '100', unit_id: 2 }],
    })
  })

  test('Admin cannot cancel; can pay the dealer', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    mock.on('get', '/purchases/{id}', purchase)
    await page.goto('/purchases/31')
    await expect(page.getByRole('link', { name: 'Pay dealer' })).toHaveAttribute(
      'href',
      /direction=paid&party=8/,
    )
    await expect(page.getByRole('button', { name: 'Cancel purchase' })).toHaveCount(0)
  })
})

test.describe('transfers (#27–#29)', () => {
  const t: S['Transfer'] = {
    id: 12,
    doc_no: 'T/26-27/0012',
    transfer_date: '2026-10-18',
    from_location_id: 2,
    to_location_id: 1,
    created_by_name: 'Suresh B',
    lines: [{ item_id: 41, item_name: 'JSW 12 mm', base_qty: '500.000', unit: 'kg' }],
  }

  test('prefilled from a shortage, short stock marks the line, then the note', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let first = true
    mock
      .on('post', '/stock-transfers', () => {
        if (!first) return t
        first = false
        return problem(422, 'INSUFFICIENT_STOCK', {
          short_lines: [
            {
              line_no: 1,
              item_id: 41,
              item_name: 'JSW 12 mm',
              location_id: 2,
              location_name: 'Godown 1',
              required: '5000.000',
              available: '1500.000',
              unit: 'kg',
            },
          ],
        })
      })
      .on('get', '/stock-transfers/{id}', t)
    await page.goto('/transfers/new?item=41&from=2&to=1')
    await expect(page.getByLabel('From')).toHaveValue('2')
    await expect(page.getByLabel('To', { exact: true })).toHaveValue('1')
    await page.getByLabel('To', { exact: true }).selectOption('2')
    await fillLine(page, 1, 'JSW', '5000', 'Transfer lines')
    await page.getByRole('button', { name: 'Save transfer' }).click()
    await expect(page.getByText('Choose a different location')).toBeVisible()
    await page.getByLabel('To', { exact: true }).selectOption('1')
    await page.getByRole('button', { name: 'Save transfer' }).click()
    await expect(page.getByText('Not enough stock at the source')).toBeVisible()
    await expect(page.getByText('Only 1,500 kg at Godown 1').first()).toBeVisible()
    await page.getByRole('button', { name: 'Save transfer' }).click()
    await expect(page.getByRole('heading', { name: /Transfer note/ })).toBeVisible()
    await expect(page.getByText('Godown 1', { exact: true })).toBeVisible()
    expect(mock.calls('POST', '/stock-transfers')[1]!.body).toMatchObject({
      from_location_id: 2,
      to_location_id: 1,
      lines: [{ item_id: 41, qty: '5000', unit_id: 2 }],
    })
  })
})

test.describe('adjustments and counts (#30–#32)', () => {
  test('a damage adjustment removes stock as a negative change; "other" needs notes', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock
      .on('post', '/stock-adjustments', { id: 3, doc_no: 'ADJ/26-27/0003' })
      .on('get', '/stock-adjustments', data.page<S['Adjustment']>([]))
    await page.goto('/adjustments/new')
    await page.getByLabel('Reason').selectOption('other')
    await fillLine(page, 1, 'UltraTech', '5', 'Adjustment lines')
    await page.getByRole('button', { name: 'Save adjustment' }).click()
    await expect(page.getByText('Explain the adjustment')).toBeVisible()
    await page.getByLabel('Reason').selectOption('breakage')
    await page.getByRole('button', { name: 'Save adjustment' }).click()
    await expect(page.getByText('Adjustment ADJ/26-27/0003 saved')).toBeVisible()
    expect(mock.calls('POST', '/stock-adjustments')[0]!.body).toMatchObject({
      location_id: 1,
      reason: 'breakage',
      lines: [{ item_id: 12, qty_change: '-5' }],
    })
  })

  test('physical count: count, preview the differences, post', async ({ page, mock, signIn }) => {
    await signIn()
    mock
      .on('post', '/stock-counts/preview', {
        location_id: 2,
        lines: [
          {
            item_id: 41,
            item_name: 'JSW 12 mm',
            system_qty: '1500.000',
            counted_qty: '1480.000',
            difference: '-20.000',
            value_difference: '-1250.00',
          },
          {
            item_id: 12,
            item_name: 'UltraTech OPC 53',
            system_qty: '40.000',
            counted_qty: '40.000',
            difference: '0.000',
            value_difference: '0.00',
          },
        ],
      })
      .on('post', '/stock-counts', { id: 9, doc_no: 'ADJ/26-27/0009' })
      .on('get', '/stock-adjustments', data.page<S['Adjustment']>([]))
    await page.goto('/stock-counts/new')
    await page.getByLabel('Location').selectOption({ label: 'Godown 1' })
    await page.getByLabel('Counted JSW 12 mm').fill('1480')
    await page.getByLabel('Counted UltraTech OPC 53').fill('40')
    await page.getByRole('button', { name: 'Preview differences (2)' }).click()
    await expect(page.getByText('1 items differ')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Differences' })).toContainText('−20')
    await page.getByRole('button', { name: 'Post adjustments' }).click()
    await expect(page.getByText('Count posted as adjustment ADJ/26-27/0009')).toBeVisible()
    expect(mock.calls('POST', '/stock-counts')[0]!.body).toEqual({
      location_id: 2,
      lines: [
        { item_id: 12, counted_qty: '40' },
        { item_id: 41, counted_qty: '1480' },
      ],
    })
  })

  test('registers list transfers and adjustments with their lines', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on(
        'get',
        '/stock-adjustments',
        data.page<S['Adjustment']>([
          {
            id: 3,
            doc_no: 'ADJ/26-27/0003',
            adj_date: '2026-10-18',
            location_id: 1,
            reason: 'damage',
            lines: [{ item_id: 12, item_name: 'UltraTech OPC 53', qty_change: '-5.000' }],
            created_by_name: 'Suresh B',
          },
        ]),
      )
      .on(
        'get',
        '/stock-transfers',
        data.page<S['Transfer']>([
          {
            id: 12,
            doc_no: 'T/26-27/0012',
            transfer_date: '2026-10-18',
            from_location_id: 2,
            to_location_id: 1,
            lines: [{ item_id: 41, item_name: 'JSW 12 mm', base_qty: '500.000' }],
          },
        ]),
      )
      .on('get', '/stock-transfers/{id}', { id: 12, doc_no: 'T/26-27/0012' })
      .on('get', '/purchases', data.page([purchase]))
      .on('get', '/purchases/{id}', purchase)
    await page.goto('/adjustments')
    await expect(page.getByText('UltraTech OPC 53').first()).toBeVisible()
    await expect(page.getByText('−5').first()).toBeVisible()
    await page.goto('/transfers')
    await expect(page.getByText('Godown 1 → Shop').first()).toBeVisible()
    await page.goto('/purchases')
    await expect(page.getByText('P/26-27/0031').first()).toBeVisible()
  })
})
