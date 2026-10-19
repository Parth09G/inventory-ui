import { Reply } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

test.describe('dashboard (#4)', () => {
  test('pending work first, hero sales, tiles and actions lead somewhere', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('get', '/returns', data.page<S['CreditNote']>([]))
    await page.goto('/')
    const pending = page.getByRole('region', { name: 'Pending work' })
    await expect(pending).toContainText('1 e-invoices failed')
    await expect(pending).toContainText('2 returns to approve')
    await expect(page.getByTestId('hero-sales')).toHaveText('₹ 4,12,650.00')
    await expect(
      page.getByText('37 bills · Cash ₹ 2,98,400.00 · Account ₹ 1,14,250.00'),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /Receivables/ })).toHaveAttribute(
      'href',
      '/parties?balance=receivable',
    )
    const low = page.getByRole('region', { name: 'Low and out of stock' })
    await expect(
      low.getByRole('link', { name: 'New purchase of UltraTech OPC 53' }),
    ).toHaveAttribute('href', '/purchases/new?item=12')
    await expect(low.getByRole('link', { name: 'Transfer ACC PPC' })).toHaveCount(0)
    await pending.getByRole('link', { name: /returns to approve/ }).click()
    await expect(page).toHaveURL(/\/returns\?status=pending/)
  })

  test('the period switch changes the range; the chart has a table view', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    await page.goto('/')
    const chart = page.getByRole('region', { name: 'Sales trend' })
    await expect(chart.locator('.recharts-bar-rectangle').first()).toBeVisible()
    await chart.getByRole('button', { name: 'Show as table' }).click()
    await expect(chart.getByRole('table')).toContainText('19 Oct')
    await page.getByRole('tab', { name: 'FY' }).click()
    await expect(page).toHaveURL(/period=fy/)
    await expect
      .poll(() => mock.calls('GET', '/dashboard/summary').at(-1)?.query.get('from'))
      .toMatch(/^\d{4}-04-01$/)
    await expect
      .poll(() => mock.calls('GET', '/dashboard/sales-trend').at(-1)?.query.get('bucket'))
      .toBe('month')
    await expect(page.getByRole('region', { name: 'Pending work' })).toContainText(
      '2 returns awaiting approval',
    )
  })
})

test.describe('notifications (#5)', () => {
  test('lists notifications, marks read, and opens the related record', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let read = false
    const list = (): S['Notification'][] => [
      {
        id: 5,
        kind: 'stock_short',
        title: 'Bill blocked: JSW 12 mm short at Shop',
        body: 'Needed 500 kg, had 120 kg (Suresh B)',
        item_id: 41,
        is_read: read,
        created_at: '2026-10-19T04:30:00Z',
      },
      {
        id: 6,
        kind: 'return_pending',
        title: 'Return waiting for approval',
        ref_type: 'credit_note',
        ref_id: 55,
        is_read: true,
        created_at: '2026-10-18T10:00:00Z',
      },
    ]
    mock
      .on('get', '/notifications', () => data.page(list()))
      .on('post', '/notifications/{id}/read', () => ((read = true), new Reply(204)))
      .on('get', '/items/{id}', data.items[0]!)
    await page.goto('/notifications')
    const items = page.getByRole('list', { name: 'Notifications' })
    await expect(items).toContainText('Bill blocked: stock')
    await items.getByRole('button', { name: 'Mark read' }).click()
    await expect(items.getByText('Unread')).toHaveCount(0)
    await items.getByRole('link', { name: 'Bill blocked: JSW 12 mm short at Shop' }).click()
    await expect(page).toHaveURL(/\/items\/41$/)
  })
})

test.describe('reports (#36, #37)', () => {
  const report = {
    columns: [
      { key: 'bill_no', label: 'Bill no.', type: 'text' as const },
      { key: 'bill_date', label: 'Date', type: 'date' as const },
      { key: 'customer', label: 'Customer', type: 'text' as const },
      { key: 'taxable', label: 'Taxable ₹', type: 'money' as const },
      { key: 'total', label: 'Total ₹', type: 'money' as const },
    ],
    rows: [
      {
        bill_no: 'C/26-27/0418',
        bill_date: '2026-10-10',
        customer: 'Ravi Builders',
        taxable: '125805.00',
        total: '148450.00',
      },
      {
        bill_no: 'C/26-27/0419',
        bill_date: '2026-10-11',
        customer: 'Mahesh',
        taxable: '3347.46',
        total: '3950.00',
      },
    ],
    totals: { taxable: '129152.46', total: '152400.00' },
    meta: { page: 1, page_size: 100, total: 2 },
  }

  test('catalogue → sales register with server columns, totals, filters and exports', async ({
    page,
    mock,
    signIn,
    context,
    isMobile,
  }) => {
    await signIn()
    mock.on('get', '/reports/{key}', (r) => {
      const f = r.query.get('format')
      if (f === 'xlsx')
        return { url: 'https://storage.mock/sales.xlsx', expires_at: '2026-10-19T10:00:00Z' }
      if (f === 'pdf')
        return new Reply(202, {
          id: 'job-9',
          kind: 'report_export',
          status: 'succeeded',
          progress: 100,
          result_url: 'https://storage.mock/sales.pdf',
        })
      return report
    })
    mock.on('get', '/jobs/{id}', {
      id: 'job-9',
      kind: 'report_export',
      status: 'succeeded',
      progress: 100,
      result_url: 'https://storage.mock/sales.pdf',
    })
    await context.route('https://storage.mock/**', (r) => r.fulfill({ body: 'file' }))
    await page.goto('/reports')
    await page.getByRole('link', { name: /Sales register/ }).click()
    await expect(page.getByRole('heading', { name: 'Sales register' })).toBeVisible()
    if (!isMobile) {
      const table = page.getByRole('table', { name: 'Sales register' })
      await expect(table).toContainText('1,48,450.00')
      await expect(table.locator('tfoot')).toContainText('1,52,400.00')
    } else
      await expect(page.getByRole('list', { name: 'Sales register' })).toContainText('C/26-27/0418')
    const first = mock.calls('GET', '/reports/sales-register')[0]!
    expect(first.query.get('format')).toBe('json')
    expect(first.query.get('from')).toMatch(/^\d{4}-\d{2}-01$/)
    await page.getByLabel('Location').selectOption({ label: 'Godown 1' })
    await expect
      .poll(() => mock.calls('GET', '/reports/sales-register').at(-1)?.query.get('location_id'))
      .toBe('2')
    const popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Excel' }).click()
    expect((await popup).url()).toBe('https://storage.mock/sales.xlsx')
    await page.getByRole('button', { name: 'PDF' }).click()
    await expect(page.getByRole('button', { name: 'Download result' })).toBeVisible()
  })

  test('an unknown report is a 404', async ({ page, signIn }) => {
    await signIn()
    await page.goto('/reports/not-a-report')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})
