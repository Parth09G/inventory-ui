import { problem, Reply } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

test.describe('parties (#16, #17, #18)', () => {
  test.beforeEach(async ({ mock }) => {
    mock
      .on('get', '/parties', (r) => {
        const kind = r.query.get('kind')
        return data.page(kind ? data.parties.filter((p) => p.kind === kind) : data.parties)
      })
      .on('get', '/parties/{id}', (r) => data.parties.find((p) => p.id === Number(r.params.id))!)
      .on('get', '/parties/{id}/ledger', data.ledger)
  })

  test('list tabs filter by type and show balances as Dr/Cr', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    await signIn()
    await page.goto('/parties')
    const list = isMobile
      ? page.getByRole('list', { name: 'Parties' })
      : page.getByRole('table', { name: 'Parties' })
    await expect(list.getByText('98,450.00')).toBeVisible()
    await expect(list.getByText('1,40,500.00')).toBeVisible()
    await page.getByRole('tab', { name: 'Dealers' }).click()
    await expect(page).toHaveURL(/kind=supplier/)
    await expect(list.getByText('Ravi Builders')).toBeHidden()
    await page.getByLabel('Balance').selectOption('payable')
    await expect
      .poll(() => mock.calls('GET', '/parties').at(-1)?.query.get('with_balance'))
      .toBe('payable')
  })

  test('creates a dealer with GSTIN-derived state, a site and a payable opening balance', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock.on(
      'post',
      '/parties',
      (r) =>
        ({
          ...(r.body as S['PartyInput']),
          id: 50,
          balance: '-25000.00',
          is_active: true,
        }) as S['Party'],
    )
    mock.on('get', '/parties/{id}', (r) => ({
      ...data.parties[1]!,
      id: Number(r.params.id),
      name: 'Sri Ganesh Hardware',
    }))
    await page.goto('/parties/new?kind=supplier')
    await expect(page.getByRole('radio', { name: 'Dealer (supplier)' })).toBeChecked()
    await page.getByLabel('Name').fill('Sri Ganesh Hardware')
    await page.getByLabel('Mobile').fill('98450 77777')
    await page.getByLabel('GSTIN').fill('33aaacg5678m1z9')
    await expect(page.getByLabel('State')).toHaveValue('33')
    await page.getByRole('button', { name: 'Add site' }).click()
    await page.getByLabel('Site 1 name').fill('Hosur road godown')
    await page.getByLabel('Address', { exact: true }).fill('Hosur Road, Bengaluru')
    await page.getByLabel('Opening balance ₹').fill('25000')
    await expect(page.getByRole('radio', { name: 'We owe them (Cr)' })).toBeChecked()
    await page.getByRole('button', { name: 'Add party' }).click()
    await expect(page.getByText('Sri Ganesh Hardware added')).toBeVisible()
    expect(mock.calls('POST', '/parties')[0]!.body).toMatchObject({
      kind: 'supplier',
      name: 'Sri Ganesh Hardware',
      mobile: '9845077777',
      gstin: '33AAACG5678M1Z9',
      state_code: '33',
      opening_balance: '-25000',
      sites: [{ label: 'Hosur road godown', address: 'Hosur Road, Bengaluru' }],
    })
  })

  test('form validation and duplicate GSTIN', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('post', '/parties', problem(409, 'DUPLICATE'))
    await page.goto('/parties/new')
    await page.getByLabel('Mobile').fill('12345')
    await page.getByRole('button', { name: 'Add party' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()
    await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible()
    await page.getByLabel('Name').fill('Ravi Builders')
    await page.getByLabel('Mobile').fill('9845012345')
    await page.getByLabel('GSTIN').fill('29ABCDE1234F1Z5')
    await page.getByRole('button', { name: 'Add party' }).click()
    await expect(page.getByText('Another party already has this GSTIN')).toBeVisible()
  })

  test('party page shows the ledger with closing balance and downloads a statement', async ({
    page,
    mock,
    signIn,
    context,
  }) => {
    await signIn()
    mock.on('get', '/parties/{id}/statement', {
      url: 'https://storage.mock/statement.pdf',
      expires_at: '2026-10-18T10:00:00Z',
    })
    await context.route('https://storage.mock/**', (r) => r.fulfill({ body: '%PDF' }))
    await context.route('https://wa.me/**', (r) => r.fulfill({ body: 'whatsapp' }))
    await page.goto('/parties/7')
    await expect(page.getByRole('heading', { name: 'Ravi Builders' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Balance' })).toContainText('98,450.00Dr')
    await expect(page.getByText('C/26-27/0418')).toBeVisible()
    await expect(page.getByText('R/26-27/0102')).toBeVisible()

    await page.getByLabel('From').fill('1/10/26')
    await page.getByLabel('From').press('Enter')
    await expect(page.getByLabel('From')).toHaveValue('01-10-2026')
    await expect
      .poll(() => mock.calls('GET', '/parties/7/ledger').at(-1)?.query.get('from'))
      .toBe('2026-10-01')

    await page.getByRole('button', { name: 'Statement' }).click()
    const popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Download statement' }).click()
    expect((await popup).url()).toBe('https://storage.mock/statement.pdf')

    const wa = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'WhatsApp reminder' }).click()
    const url = new URL((await wa).url())
    expect(url.pathname).toBe('/919845012345')
    expect(url.searchParams.get('text')).toContain(
      'your outstanding balance with us is ₹ 98,450.00 Dr',
    )
  })

  test('Super Admin deactivates a party', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('post', '/parties/{id}/deactivate', new Reply(204))
    await page.goto('/parties/9')
    await page.getByRole('button', { name: 'Deactivate' }).click()
    await page.getByRole('button', { name: 'Deactivate party' }).click()
    await expect(page.getByText('Walk-in Mahesh deactivated')).toBeVisible()
    await expect(page).toHaveURL(/\/parties$/)
    expect(mock.calls('POST', '/parties/9/deactivate')).toHaveLength(1)
  })

  test('Admin sees no deactivate action', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/parties/8')
    await expect(page.getByRole('heading', { name: 'Jindal Steel Traders' })).toBeVisible()
    await expect(page.getByText('We owe them')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
  })
})
