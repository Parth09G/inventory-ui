import { billFrom } from './support/billing'
import { problem } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

const input: S['BillInput'] = {
  bill_type: 'cash',
  status: 'active',
  bill_date: '2026-10-18',
  customer: { party_id: 7 },
  place_of_supply: '29',
  vehicle_no: 'KA05AB1234',
  lines: [{ item_id: 41, location_id: 2, qty: '1.5', unit_id: 3, rate: '68500' }],
}
const active = billFrom(
  { ...input, payments: [{ mode: 'upi', amount: '50000' }] },
  {
    version: 2,
    einvoice: {
      status: 'generated',
      irn: 'a1b2c3d4e5',
      ack_no: '1123456789',
      ack_date: '2026-10-18T05:00:00Z',
      cancel_deadline: '2026-10-19T05:00:00Z',
    },
    payments: [
      {
        payment_id: 301,
        doc_no: 'R/26-27/0102',
        mode: 'upi',
        amount: '50000.00',
        date: '2026-10-18',
      },
    ],
    allowed_actions: [
      'print',
      'share',
      'copy_to_account',
      'edit',
      'cancel',
      'cancel_einvoice',
      'record_payment',
      'create_return',
    ],
  },
)

test.describe('bill view (#9)', () => {
  test.beforeEach(async ({ mock }) => {
    mock.on('get', '/lookups/states', data.states)
  })

  test('shows the bill and its server-allowed actions; prints and shares', async ({
    page,
    mock,
    signIn,
    context,
  }) => {
    await signIn()
    mock
      .on('get', '/bills/{id}', active)
      .on('get', '/bills/{id}/pdf', {
        url: 'https://storage.mock/C-0418.pdf',
        expires_at: '2026-10-18T10:00:00Z',
      })
      .on('post', '/bills/{id}/share', {
        whatsapp_url: 'https://wa.me/919845012345?text=bill',
        pdf_url: 'https://storage.mock/C-0418.pdf',
      })
    await context.route('https://storage.mock/**', (r) => r.fulfill({ body: '%PDF' }))
    await context.route('https://wa.me/**', (r) => r.fulfill({ body: 'wa' }))
    await page.goto('/bills/1052')
    await expect(page.getByRole('heading', { name: /Cash bill C\/26-27\/0418/ })).toBeVisible()
    await expect(page.getByText('Part paid')).toBeVisible()
    await expect(page.getByText('IRN generated').first()).toBeVisible()
    await expect(page.getByText('Version 2')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Bill lines' })).toContainText('1.5 ton')
    await expect(page.getByRole('region', { name: 'Totals' })).toContainText('Balance due')

    let popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Print', exact: true }).click()
    expect((await popup).url()).toBe('https://storage.mock/C-0418.pdf')
    popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Share' }).click()
    expect((await popup).url()).toContain('https://wa.me/919845012345')

    await page.getByRole('tab', { name: 'Payments (1)' }).click()
    await expect(page.getByText('R/26-27/0102')).toBeVisible()
    await page.getByRole('tab', { name: 'E-invoice' }).click()
    await expect(page.getByText('a1b2c3d4e5')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel IRN' })).toBeVisible()
  })

  test('Admin sees no edit or cancel: the server left them out of allowed_actions', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock.on('get', '/bills/{id}', {
      ...active,
      allowed_actions: ['print', 'share', 'copy_to_account', 'record_payment', 'create_return'],
    })
    await page.goto('/bills/1052')
    await expect(page.getByRole('button', { name: 'Copy to Account bill' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cancel bill' })).toHaveCount(0)
  })

  test('cancel needs a reason and sends If-Match; a version clash reloads', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let calls = 0
    mock.on('get', '/bills/{id}', active).on('post', '/bills/{id}/cancel', (r) => {
      calls++
      return calls === 1
        ? problem(412, 'VERSION_MISMATCH')
        : {
            ...active,
            status: 'cancelled' as const,
            cancel_reason: (r.body as { reason: string }).reason,
            allowed_actions: ['print' as const],
          }
    })
    await page.goto('/bills/1052')
    await page.getByRole('button', { name: 'Cancel bill' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Stock goes back to the line locations')
    await dialog.getByRole('button', { name: 'Cancel bill' }).click()
    await expect(dialog.getByText('Give a reason')).toBeVisible()
    await dialog.getByLabel('Reason').fill('Customer returned the order')
    await dialog.getByRole('button', { name: 'Cancel bill' }).click()
    await expect(dialog.getByText('Someone else changed this bill')).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel bill' }).click()
    await expect(page.getByText('Bill C/26-27/0418 cancelled')).toBeVisible()
    await expect(page.getByText('CANCELLED')).toBeVisible()
    const req = mock.calls('POST', '/bills/1052/cancel')[0]!
    expect(req.headers['if-match']).toBe('"2"')
    expect(req.body).toEqual({ reason: 'Customer returned the order' })
  })

  test('while the IRN is pending, print waits; it becomes available once generated', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let polls = 0
    mock.on('get', '/bills/{id}', () => {
      polls++
      return polls < 3 ? { ...active, einvoice: { status: 'pending' as const } } : active
    })
    await page.goto('/bills/1052')
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled({
      timeout: 15_000,
    })
    expect(polls).toBeGreaterThanOrEqual(3)
  })

  test('copy to Account bill opens the new bill', async ({ page, mock, signIn }) => {
    await signIn()
    const copy = billFrom(
      { ...input, bill_type: 'account' },
      { id: 1060, source_bill: { id: 1052, bill_no: 'C/26-27/0418' }, allowed_actions: ['print'] },
    )
    mock
      .on('get', '/bills/{id}', (r) => (r.params.id === '1060' ? copy : active))
      .on('post', '/bills/{id}/copy-to-account', copy)
    await page.goto('/bills/1052')
    await page.getByRole('button', { name: 'Copy to Account bill' }).click()
    await expect(page).toHaveURL(/\/bills\/1060$/)
    await expect(page.getByRole('heading', { name: /Account bill A\/26-27\/0107/ })).toBeVisible()
    await expect(page.getByText('Copy of')).toBeVisible()
    expect(
      mock.calls('POST', '/bills/1052/copy-to-account')[0]!.headers['idempotency-key'],
    ).toBeTruthy()
  })

  test('history lists earlier versions with their reason', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('get', '/bills/{id}', active).on('get', '/bills/{id}/revisions', [
      {
        version: 1,
        reason: 'Rate corrected',
        edited_by_name: 'Ramesh Kumar',
        edited_at: '2026-10-18T06:00:00Z',
        snapshot: billFrom(input),
      },
    ])
    await page.goto('/bills/1052?tab=history')
    await expect(page.getByText('Version 1')).toBeVisible()
    await expect(page.getByText('Reason: Rate corrected')).toBeVisible()
  })
})

test.describe('edit a saved bill (#8)', () => {
  test('Super Admin edits with a reason and If-Match', async ({ page, mock, signIn }) => {
    await signIn()
    mock
      .on('get', '/settings', data.settings)
      .on('get', '/bills/{id}', active)
      .on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
      .on('get', '/parties/{id}', data.parties[0]!)
      .on('get', '/items/{id}/price-hints', { recent_rates: [], avg_cost: '62.5000' })
      .on('post', '/bills/calculate', (r) => ({
        ...billFrom(r.body as S['BillInput']),
        stock_warnings: [],
      }))
      .on(
        'put',
        '/bills/{id}',
        (r) => ({ ...active, version: 3, ...(r.body as object) }) as S['Bill'],
      )
    await page.goto('/bills/1052/edit')
    await expect(page.getByRole('heading', { name: /Edit Cash bill C\/26-27\/0418/ })).toBeVisible()
    await expect(page.getByText('The IRN will be cancelled and a new one generated.')).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByLabel('Reason').fill('Wrong rate')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/bills\/1052$/)
    const req = mock.calls('PUT', '/bills/1052')[0]!
    expect(req.headers['if-match']).toBe('"2"')
    expect(req.body).toMatchObject({
      reason: 'Wrong rate',
      status: 'active',
      lines: [{ item_id: 41, qty: '1.5', unit_id: 3 }],
    })
  })

  test('an Admin opening edit on a saved bill is told why not', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    mock
      .on('get', '/settings', data.settings)
      .on('get', '/bills/{id}', { ...active, allowed_actions: ['print'] })
    await page.goto('/bills/1052/edit')
    await expect(page.getByRole('heading', { name: 'This bill cannot be edited' })).toBeVisible()
  })
})

test.describe('bill register (#6)', () => {
  const rows: S['BillSummary'][] = [
    {
      id: 1052,
      bill_type: 'cash',
      bill_no: 'C/26-27/0418',
      bill_date: '2026-10-18',
      status: 'active',
      customer_name: 'Ravi Builders',
      grand_total: '148450.00',
      balance_due: '98450.00',
      payment_status: 'partial',
      einvoice_status: 'generated',
    },
    {
      id: 2001,
      bill_type: 'cash',
      bill_no: null,
      bill_date: '2026-10-18',
      status: 'draft',
      customer_name: 'Mahesh',
      grand_total: '3950.00',
    },
    {
      id: 1060,
      bill_type: 'account',
      bill_no: 'A/26-27/0107',
      bill_date: '2026-10-18',
      status: 'active',
      customer_name: 'Ravi Builders',
      grand_total: '148450.00',
      balance_due: '0.00',
      payment_status: 'paid',
      is_account_copy: true,
      einvoice_status: 'not_required',
    },
  ]

  test('filters go to the server and drafts open in the editor', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    await signIn()
    mock.on('get', '/bills', (r) =>
      data.page(
        r.query.get('status') === 'draft' ? rows.filter((b) => b.status === 'draft') : rows,
      ),
    )
    await page.goto('/bills')
    const list = isMobile
      ? page.getByRole('list', { name: 'Bills' })
      : page.getByRole('table', { name: 'Bills' })
    await expect(list.getByText('C/26-27/0418')).toBeVisible()
    await expect(list.getByText('Account copy')).toBeVisible()
    await page.getByLabel('Payment').selectOption('partial')
    await expect
      .poll(() => mock.calls('GET', '/bills').at(-1)?.query.get('payment_status'))
      .toBe('partial')
    await page.getByLabel('Account bills not linked to a Cash bill').check()
    await expect
      .poll(() => mock.calls('GET', '/bills').at(-1)?.query.get('unlinked_account_bills'))
      .toBe('true')
    await page.getByRole('tab', { name: 'Drafts' }).click()
    await expect.poll(() => mock.calls('GET', '/bills').at(-1)?.query.get('status')).toBe('draft')
    await expect(list.getByRole('link', { name: /Draft/ }).first()).toHaveAttribute(
      'href',
      '/bills/2001/edit',
    )
  })
})
