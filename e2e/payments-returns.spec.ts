import { billFrom } from './support/billing'
import { Reply } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

const bill = billFrom(
  {
    bill_type: 'cash',
    status: 'active',
    bill_date: '2026-10-10',
    customer: { party_id: 7 },
    place_of_supply: '29',
    lines: [{ item_id: 41, location_id: 1, qty: '100', unit_id: 2, rate: '68.5' }],
  },
  {
    allowed_actions: ['print', 'record_payment', 'create_return'],
    einvoice: { status: 'not_required' },
  },
)
const bill1052 = { ...bill, lines: bill.lines.map((l, i) => ({ ...l, id: 900 + i })) }

const summary: S['BillSummary'] = {
  id: 1052,
  bill_type: 'cash',
  bill_no: 'C/26-27/0418',
  bill_date: '2026-10-10',
  status: 'active',
  customer_name: 'Ravi Builders',
  party_id: 7,
  grand_total: '8083.00',
  balance_due: '8083.00',
  payment_status: 'unpaid',
}
const payment = (over: Partial<S['Payment']> = {}): S['Payment'] => ({
  id: 301,
  doc_no: 'R/26-27/0102',
  direction: 'received',
  party_id: 7,
  party_name: 'Ravi Builders',
  pay_date: '2026-10-18',
  mode: 'upi',
  amount: '8083.00',
  reference: 'UPI/628401',
  status: 'active',
  allocations: [{ ref_type: 'cash_bill', ref_id: 1052, ref_no: 'C/26-27/0418', amount: '8083.00' }],
  unallocated: '0.00',
  ...over,
})
const creditNote = (over: Partial<S['CreditNote']> = {}): S['CreditNote'] => ({
  id: 55,
  cn_no: null,
  cn_date: '2026-10-18',
  bill_id: 1052,
  bill_no: 'C/26-27/0418',
  party_name: 'Ravi Builders',
  status: 'pending',
  reason: 'Excess material',
  settlement: 'adjust_ledger',
  created_by_name: 'Suresh B',
  lines: [
    {
      bill_line_id: 900,
      description: 'JSW 12 mm',
      qty: '20.000',
      unit: 'kg',
      rate: '68.50',
      taxable_value: '1370.00',
      restock: true,
    },
  ],
  totals: { taxable_total: '1370.00', cgst: '123.30', sgst: '123.30', grand_total: '1617.00' },
  ...over,
})

test.beforeEach(async ({ mock }) => {
  mock
    .on('get', '/lookups/states', data.states)
    .on('get', '/bills/{id}', bill1052)
    .on('get', '/parties/{id}', (r) => data.parties.find((p) => p.id === Number(r.params.id))!)
    .on('get', '/parties', data.page(data.parties))
})

test.describe('payments (#13, #14, #15)', () => {
  test('from a bill: prefilled customer, bill allocation and amount', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock
      .on('get', '/bills', data.page([summary]))
      .on('post', '/payments', (r) => payment({ amount: (r.body as S['PaymentInput']).amount }))
    mock.on('get', '/payments/{id}', payment())
    await page.goto('/bills/1052')
    await page.getByRole('link', { name: 'Record payment' }).click()
    await expect(page.getByRole('heading', { name: 'Record receipt' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Customer' })).toHaveValue('Ravi Builders')
    await expect(page.getByRole('radio', { name: 'Choose bills' })).toBeChecked()
    await expect(page.getByLabel('Apply to C/26-27/0418')).toHaveValue('8083.00')
    await expect(page.getByLabel('Payment 1 amount')).toHaveValue('8083.00')
    await page.getByLabel('Payment 1 mode').selectOption('upi')
    await page.getByLabel('Payment 1 UPI reference').fill('UPI/628401')
    await page.getByRole('button', { name: 'Save receipt' }).click()
    await expect(page.getByText('Receipt R/26-27/0102 saved')).toBeVisible()
    await expect(page).toHaveURL(/\/payments\/301$/)
    const req = mock.calls('POST', '/payments')[0]!
    expect(req.headers['idempotency-key']).toBeTruthy()
    expect(req.body).toMatchObject({
      direction: 'received',
      party_id: 7,
      mode: 'upi',
      amount: '8083.00',
      reference: 'UPI/628401',
      auto_allocate: false,
      allocations: [{ ref_type: 'cash_bill', ref_id: 1052, amount: '8083.00' }],
    })
  })

  test('cheque receipts need the cheque number; oldest bills first by default', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on('get', '/bills', data.page([summary]))
      .on('post', '/payments', payment({ mode: 'cheque' }))
      .on('get', '/payments/{id}', payment())
    await page.goto('/payments/new?party=7')
    await expect(page.getByRole('radio', { name: 'Oldest bills first (automatic)' })).toBeChecked()
    await page.getByLabel('Payment 1 mode').selectOption('cheque')
    await page.getByLabel('Payment 1 amount').fill('20000')
    await page.getByRole('button', { name: 'Save receipt' }).click()
    await expect(page.getByText('Enter the cheque number')).toBeVisible()
    await page.getByLabel('Payment 1 cheque number').fill('004512')
    await page.getByLabel('Payment 1 bank').fill('Canara Bank')
    await page.getByRole('button', { name: 'Save receipt' }).click()
    await expect(page).toHaveURL(/\/payments\/301$/)
    expect(mock.calls('POST', '/payments')[0]!.body).toMatchObject({
      mode: 'cheque',
      cheque_no: '004512',
      bank_name: 'Canara Bank',
      auto_allocate: true,
    })
  })

  test('a bounced cheque reopens the amount; Super Admin can cancel', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let p = payment({
      mode: 'cheque',
      cheque_no: '004512',
      cheque_status: 'pending',
      reference: null,
    })
    mock
      .on('get', '/payments/{id}', () => p)
      .on(
        'post',
        '/payments/{id}/cheque-status',
        (r) => (p = { ...p, cheque_status: (r.body as { status: 'bounced' }).status }),
      )
      .on('post', '/payments/{id}/cancel', () => (p = { ...p, status: 'cancelled' }))
    await page.goto('/payments/301')
    await page.getByRole('button', { name: 'Mark bounced' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('₹ 8,083.00 is owed again')
    await page.getByRole('button', { name: 'Mark bounced' }).last().click()
    await expect(page.getByText('Cheque marked bounced')).toBeVisible()
    await expect(page.getByText('Cheque bounced')).toBeVisible()
    expect(mock.calls('POST', '/payments/301/cheque-status')[0]!.body).toEqual({
      status: 'bounced',
    })
    await page.getByRole('button', { name: 'Cancel payment' }).click()
    await page.getByLabel('Reason').fill('Entered twice')
    await page.getByRole('button', { name: 'Cancel payment' }).last().click()
    await expect(page.getByText('R/26-27/0102 cancelled')).toBeVisible()
  })

  test('Admin cannot cancel payments; register filters by direction and mode', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock
      .on('get', '/payments', (r) =>
        data.page(r.query.get('direction') === 'paid' ? [] : [payment()]),
      )
      .on('get', '/payments/{id}', payment())
    await page.goto('/payments')
    await expect(page.getByText('R/26-27/0102').first()).toBeVisible()
    await page.getByRole('tab', { name: 'Paid to dealers' }).click()
    await expect(page.getByText('No payments in this view.')).toBeVisible()
    await page.getByLabel('Mode').selectOption('cheque')
    await expect.poll(() => mock.calls('GET', '/payments').at(-1)?.query.get('mode')).toBe('cheque')
    await page.goto('/payments/301')
    await expect(page.getByRole('heading', { name: /Receipt/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel payment' })).toHaveCount(0)
  })
})

test.describe('returns (#10, #11, #12)', () => {
  test('Admin creates a return that waits for approval', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    mock.on('get', '/returns/{id}', creditNote()).on('post', '/returns', creditNote())
    await page.goto('/bills/1052')
    await page.getByRole('link', { name: 'Return', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Return goods' })).toBeVisible()
    await page.getByRole('button', { name: 'Send for approval' }).click()
    await expect(
      page.getByText('Enter the quantity coming back for at least one line'),
    ).toBeVisible()
    await page.getByLabel('Return quantity for JSW 12 mm').fill('20')
    await page.getByLabel('Return JSW 12 mm to').selectOption({ label: 'Godown 1' })
    await page.getByLabel('Reason').fill('Excess material')
    await page.getByRole('button', { name: 'Send for approval' }).click()
    await expect(page.getByText('Return sent to the owner for approval')).toBeVisible()
    await expect(page.getByText('Waiting for the owner (Super Admin) to approve.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    const req = mock.calls('POST', '/returns')[0]!
    expect(req.headers['idempotency-key']).toBeTruthy()
    expect(req.body).toEqual({
      bill_id: 1052,
      cn_date: expect.any(String),
      reason: 'Excess material',
      settlement: 'adjust_ledger',
      lines: [{ bill_line_id: 900, qty: '20', unit_id: 2, location_id: 2, restock: true }],
    })
  })

  test('Super Admin approves a pending return', async ({ page, mock, signIn }) => {
    await signIn()
    let cn = creditNote()
    mock
      .on('get', '/returns/{id}', () => cn)
      .on(
        'post',
        '/returns/{id}/approve',
        () =>
          (cn = creditNote({
            status: 'approved',
            cn_no: 'CN/26-27/0009',
            approved_by_name: 'Ramesh Kumar',
          })),
      )
    await page.goto('/returns/55')
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Restocked lines go back into stock')
    await expect(page.getByRole('alertdialog')).toContainText('Ravi Builders’s ledger is credited.')
    await page.getByRole('button', { name: 'Approve return' }).click()
    await expect(page.getByText('Credit note CN/26-27/0009 issued')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Credit note PDF' })).toBeVisible()
  })

  test('Super Admin rejects with a reason', async ({ page, mock, signIn }) => {
    await signIn()
    mock
      .on('get', '/returns/{id}', creditNote())
      .on('post', '/returns/{id}/reject', creditNote({ status: 'rejected' }))
    await page.goto('/returns/55')
    await page.getByRole('button', { name: 'Reject' }).click()
    await page.getByLabel('Reason').fill('Goods were used')
    await page.getByRole('button', { name: 'Reject return' }).click()
    await expect(page.getByText('Return rejected')).toBeVisible()
    expect(mock.calls('POST', '/returns/55/reject')[0]!.body).toEqual({ reason: 'Goods were used' })
  })

  test('a walk-in sale can only be refunded, and the refund amount is required', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on('get', '/bills/{id}', { ...bill1052, customer: { party_id: null, name: 'Mahesh' } })
      .on('post', '/returns', creditNote({ settlement: 'refund' }))
    mock.on('get', '/returns/{id}', creditNote({ settlement: 'refund' }))
    await page.goto('/returns/new?bill=1052')
    await expect(page.getByRole('radio', { name: 'Credit the customer’s ledger' })).toBeDisabled()
    await expect(page.getByRole('radio', { name: 'Refund the money' })).toBeChecked()
    await page.getByLabel('Return quantity for JSW 12 mm').fill('5')
    await page.getByLabel('Reason').fill('Wrong size')
    await page.getByRole('button', { name: 'Create credit note' }).click()
    await expect(page.getByText('Enter the refund amount')).toBeVisible()
    await page.getByLabel('Payment 1 amount').fill('404')
    await page.getByRole('button', { name: 'Create credit note' }).click()
    await expect(page).toHaveURL(/\/returns\/55$/)
    expect(mock.calls('POST', '/returns')[0]!.body).toMatchObject({
      settlement: 'refund',
      refund: { mode: 'cash', amount: '404' },
    })
  })

  test('the register opens on pending returns for the owner', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('get', '/returns', data.page([creditNote()]))
    await page.goto('/returns')
    await expect(page.getByRole('tab', { name: 'Pending' })).toHaveAttribute('data-state', 'active')
    await expect
      .poll(() => mock.calls('GET', '/returns').at(-1)?.query.get('status'))
      .toBe('pending')
    void Reply
  })
})
