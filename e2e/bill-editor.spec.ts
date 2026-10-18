import type { Page } from '@playwright/test'
import { billFrom, calculate } from './support/billing'
import { problem } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

test.beforeEach(async ({ mock }) => {
  mock
    .on('get', '/settings', data.settings)
    .on('get', '/parties', (r) => {
      const q = (r.query.get('q') ?? '').toLowerCase()
      return data.page(
        data.parties.filter((p) => p.kind !== 'supplier' && p.name.toLowerCase().includes(q)),
      )
    })
    .on('get', '/parties/{id}', (r) => data.parties.find((p) => p.id === Number(r.params.id))!)
    .on('get', '/items', (r) => {
      const q = (r.query.get('q') ?? '').toLowerCase()
      return data.page(data.items.filter((i) => i.name.toLowerCase().includes(q)))
    })
    .on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
    .on('get', '/items/{id}/price-hints', {
      last_rate_to_customer: {
        rate: '68.50',
        unit: 'kg',
        bill_no: 'C/26-27/0390',
        date: '2026-10-02',
      },
      recent_rates: [],
      last_purchase_rate: '63.0000',
      avg_cost: '62.5000',
      unit: 'kg',
    })
    .on('post', '/bills/calculate', (r) => calculate(r.body as S['BillInput']))
    .on('get', '/bills/{id}', (r) =>
      billFrom(mock.calls('POST', '/bills').at(-1)?.body as S['BillInput'], {
        id: Number(r.params.id),
      }),
    )
})

async function pickCustomer(page: Page, text: string, option: RegExp) {
  await page.getByRole('combobox', { name: /^Customer/ }).fill(text)
  await page.getByRole('option', { name: option }).click()
}

/** Fills line `row` (1-based): grid cells on desktop, the line sheet on phone. */
async function addLine(page: Page, row: number, item: string, qty: string, rate: string) {
  const phone = (page.viewportSize()?.width ?? 1366) < 1024
  const scope = phone ? page.getByRole('dialog', { name: `Line ${row}` }) : page
  if (phone) {
    const cards = page.getByRole('list', { name: 'Bill lines' }).getByRole('button')
    if ((await cards.count()) >= row) await cards.nth(row - 1).click()
    else await page.getByRole('button', { name: 'Add item' }).click()
  }
  await scope.getByRole('combobox', { name: `Line ${row} item` }).fill(item)
  await page
    .getByRole('option', { name: new RegExp(item) })
    .first()
    .click()
  await scope.getByLabel(`Line ${row} quantity`).fill(qty)
  await scope.getByLabel(`Line ${row} rate`).fill(rate)
  if (phone) await scope.getByRole('button', { name: 'Done' }).click()
}

test.describe('bill editor (#7)', () => {
  test('keyboard-only Cash bill: customer, item, qty, rate, paid in full, Ctrl+Enter', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard flow is desktop')
    await signIn(data.admin)
    mock.on('post', '/bills', (r) => billFrom(r.body as S['BillInput']))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.keyboard.press('Alt+n')
    await expect(page.getByRole('heading', { name: 'New Cash bill' })).toBeVisible()

    const customer = page.getByRole('combobox', { name: /^Customer/ })
    await customer.focus()
    await page.keyboard.type('Ravi')
    await expect(page.getByRole('option', { name: /Ravi Builders/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(customer).toHaveValue('Ravi Builders')
    await expect(page.getByText('Balance 98,450.00Dr')).toBeVisible()

    // Choosing the customer jumps to the first item.
    await expect(page.getByRole('combobox', { name: 'Line 1 item' })).toBeFocused()
    await page.keyboard.type('JSW')
    await expect(page.getByRole('option', { name: /JSW 12 mm/ })).toBeVisible()
    await page.keyboard.press('Enter')
    // Choosing the item moves on to the unit, then Enter walks the cells.
    await expect(page.getByLabel('Line 1 unit')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Line 1 location')).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.type('100')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('price-hints')).toContainText(
      'Last to Ravi Builders: ₹ 68.50 / kg (2 Oct)',
    )
    await page.keyboard.type('68.5')
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Line 1 discount', { exact: true })).toBeFocused()
    // Enter skips the % / ₹ toggle and opens the next line.
    await page.keyboard.press('Enter')
    await expect(page.getByRole('combobox', { name: 'Line 2 item' })).toBeFocused()

    await expect(page.getByTestId('grand-total')).toHaveText('₹ 8,083.00')
    await expect(page.getByRole('region', { name: 'What saving will do' })).toContainText(
      'Stock out: 100 kg JSW 12 mm from Shop',
    )
    await page.getByRole('button', { name: 'Paid in full' }).click()
    await expect(page.getByLabel('Payment 1 amount')).toHaveValue('8083.00')
    await expect(page.getByRole('region', { name: 'What saving will do' })).toContainText(
      'Paid in full',
    )

    await page.keyboard.press('Control+Enter')
    await expect(page.getByText('Cash bill C/26-27/0418 saved')).toBeVisible()
    await expect(page).toHaveURL(/\/bills\/1052$/)
    const req = mock.calls('POST', '/bills')[0]!
    expect(req.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(req.body).toMatchObject({
      bill_type: 'cash',
      status: 'active',
      customer: { party_id: 7, gstin: '29ABCDE1234F1Z5' },
      place_of_supply: '29',
      lines: [{ item_id: 41, location_id: 1, qty: '100', unit_id: 2, rate: '68.5' }],
      payments: [{ mode: 'cash', amount: '8083.00' }],
      expected_total: '8083.00',
    })
  })

  test('walk-in customers must pay in full before the bill can be saved', async ({
    page,
    signIn,
  }) => {
    await signIn()
    await page.goto('/bills/new?type=cash')
    await pickCustomer(page, 'Mah', /Walk-in customer/)
    await page.getByLabel('Walk-in name').fill('Mahesh')
    await addLine(page, 1, 'UltraTech', '10', '395')
    const save = page.getByRole('button', { name: 'Save Cash bill' })
    await expect(page.getByText('Walk-in customers must pay in full')).toBeVisible()
    await expect(save).toBeDisabled()
    await page.getByRole('button', { name: 'Paid in full' }).click()
    await expect(save).toBeEnabled()
  })

  test('a refused save for stock shows the short line and takes it from another godown', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let attempts = 0
    mock.on('post', '/bills', (r) => {
      const body = r.body as S['BillInput']
      attempts++
      if (body.lines[0]!.location_id === 1)
        return problem(422, 'INSUFFICIENT_STOCK', {
          alert_sent: true,
          short_lines: [
            {
              line_no: 1,
              item_id: 41,
              item_name: 'JSW 12 mm',
              location_id: 1,
              location_name: 'Shop',
              required: '500.000',
              available: '120.000',
              unit: 'kg',
              available_elsewhere: [{ location_id: 2, location_name: 'Godown 1', qty: '1500.000' }],
            },
          ],
        })
      return billFrom(body)
    })
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await addLine(page, 1, 'JSW', '500', '68')
    // The calculation already warns before saving.
    await expect(
      page.getByText('Only 120 kg at Shop; this bill needs 500 kg.').first(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    const panel = page.getByRole('alert', { name: 'Stock is short' })
    await expect(panel).toContainText('Line 1 · JSW 12 mm at Shop: needs 500 kg, has 120 kg.')
    await expect(panel).toContainText('The owner has been notified')
    await panel.getByRole('button', { name: 'Take from Godown 1 (1,500 kg)' }).click()
    if (!(await page.getByRole('list', { name: 'Bill lines' }).isVisible()))
      await expect(page.getByLabel('Line 1 location')).toHaveValue('2')
    await expect(page.getByRole('button', { name: 'Save Cash bill' })).toBeEnabled()
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    await expect(page).toHaveURL(/\/bills\/1052$/)
    expect(attempts).toBe(2)
    const [first, second] = mock.calls('POST', '/bills')
    // Same form, same key: a retry after a failure can never create two bills (D-08).
    expect(second!.headers['idempotency-key']).toBe(first!.headers['idempotency-key'])
  })

  test('over the credit limit: Super Admin can save anyway', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('post', '/bills', (r) => {
      const body = r.body as S['BillInput']
      return body.override_credit_limit
        ? billFrom(body)
        : problem(422, 'CREDIT_LIMIT_EXCEEDED', {
            detail: 'Ravi Builders would owe ₹ 2,06,533.00, over the limit of ₹ 2,00,000.00.',
          })
    })
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await addLine(page, 1, 'JSW', '100', '68.5')
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('over the limit of ₹ 2,00,000.00')
    await page.getByRole('button', { name: 'Save over the limit' }).click()
    await expect(page).toHaveURL(/\/bills\/1052$/)
    expect(mock.calls('POST', '/bills').at(-1)!.body).toMatchObject({ override_credit_limit: true })
  })

  test('over the credit limit: Admin is told to ask the owner', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    mock.on(
      'post',
      '/bills',
      problem(422, 'CREDIT_LIMIT_EXCEEDED', { detail: 'Over the credit limit.' }),
    )
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await addLine(page, 1, 'JSW', '100', '68.5')
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Only the owner (Super Admin) can save over the credit limit.' }),
    ).toBeVisible()
  })

  test('server field errors land on the right line, even with a blank line before it', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    test.skip(isMobile, 'grid rows are desktop')
    await signIn()
    mock.on(
      'post',
      '/bills',
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'lines[0].unit_id', message: 'unit is not set up for this item' }],
      }),
    )
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await page.getByRole('button', { name: 'Add item' }).click()
    await addLine(page, 2, 'JSW', '100', '68.5')
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    await expect(page.getByText('unit is not set up for this item')).toBeVisible()
    await expect(page.getByLabel('Line 2 unit')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Line 1 unit')).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('Account bill: named customer, no stock column, bank payments only', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    await signIn()
    mock.on('post', '/bills', (r) => billFrom(r.body as S['BillInput']))
    await page.goto('/bills/new?type=account')
    await expect(page.getByRole('heading', { name: 'New Account bill' })).toBeVisible()
    await expect(page.getByText('Does not change stock.')).toBeVisible()
    await page.getByRole('combobox', { name: /^Customer/ }).fill('zz')
    await expect(page.getByRole('option', { name: /Walk-in/ })).toHaveCount(0)
    await page.getByRole('combobox', { name: /^Customer/ }).fill('Ravi')
    await page.getByRole('option', { name: /Ravi Builders/ }).click()
    await addLine(page, 1, 'JSW', '100', '68.5')
    if (!isMobile) await expect(page.getByLabel('Line 1 location')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'What saving will do' })).toContainText(
      'No stock change (Account bill).',
    )
    await page.getByRole('button', { name: 'Add payment' }).click()
    const modes = await page.getByLabel('Payment 1 mode').locator('option').allTextContents()
    expect(modes).toEqual(['UPI', 'Cheque', 'Bank transfer'])
    await page.getByRole('button', { name: 'Save Account bill' }).click()
    await expect(
      page.getByText('Payment 1 amount').or(page.getByText('Enter the amount')),
    ).toBeVisible()
  })

  test('Ctrl+S saves a draft without payments and continues editing it', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    test.skip(isMobile, 'shortcut is desktop')
    await signIn()
    mock.on('post', '/bills', (r) => billFrom(r.body as S['BillInput'], { id: 2001 }))
    mock.on('get', '/bills/{id}', () =>
      billFrom(mock.calls('POST', '/bills')[0]!.body as S['BillInput'], { id: 2001 }),
    )
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await addLine(page, 1, 'JSW', '100', '68.5')
    await page.getByRole('button', { name: 'Paid in full' }).click()
    await page.keyboard.press('Control+s')
    await expect(page.getByText('Draft saved')).toBeVisible()
    await expect(page).toHaveURL(/\/bills\/2001\/edit$/)
    await expect(page.getByRole('heading', { name: 'Draft cash bill' })).toBeVisible()
    const body = mock.calls('POST', '/bills')[0]!.body as S['BillInput']
    expect(body.status).toBe('draft')
    expect(body.payments).toBeUndefined()
  })

  test('phone: lines are cards edited in a bottom sheet', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    test.skip(!isMobile, 'phone layout')
    await signIn()
    mock.on('post', '/bills', (r) => billFrom(r.body as S['BillInput']))
    await page.goto('/bills/new')
    await pickCustomer(page, 'Ravi', /Ravi Builders/)
    await page.getByRole('list', { name: 'Bill lines' }).getByRole('button').first().click()
    const sheet = page.getByRole('dialog', { name: 'Line 1' })
    await sheet.getByRole('combobox', { name: 'Line 1 item' }).fill('JSW')
    await page.getByRole('option', { name: /JSW 12 mm/ }).click()
    await sheet.getByLabel('Line 1 quantity').fill('100')
    await sheet.getByLabel('Line 1 rate').fill('68.5')
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('list', { name: 'Bill lines' })).toContainText(
      '100 kg × ₹ 68.5 · Shop',
    )
    await expect(page.getByText('₹ 8,083.00').first()).toBeVisible()
    await page.getByRole('button', { name: 'Save Cash bill' }).click()
    await expect(page).toHaveURL(/\/bills\/1052$/)
  })
})
