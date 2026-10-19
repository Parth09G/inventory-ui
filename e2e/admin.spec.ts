import { problem, Reply } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

const mapping: S['TallyMapping'] = {
  sales_ledger_cash: 'Sales - Cash',
  cgst_ledger: 'CGST',
  sgst_ledger: 'SGST',
  igst_ledger: 'IGST',
}

test.describe('settings (#38)', () => {
  test.beforeEach(async ({ mock }) => {
    mock.on('get', '/settings', data.settings).on('get', '/settings/tally-mapping', mapping)
  })

  test('owner edits the shop profile; the state must match the GSTIN; saved whole', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('put', '/settings', (r) => r.body as S['Settings'])
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/shop$/)
    await page.getByLabel('State').selectOption('33')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByText('The state does not match the GSTIN')).toBeVisible()
    await page.getByLabel('State').selectOption('29')
    await page.getByLabel('Phone').fill('080 2345 6789')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByText('Settings saved')).toBeVisible()
    expect(mock.calls('PUT', '/settings')[0]!.body).toMatchObject({
      shop_name: data.settings.shop_name,
      gstin: '29AAACS1234A1Z9',
      phone: '080 2345 6789',
      state_code: '29',
    })
  })

  test('Admin sees settings read-only', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/settings/bank')
    await expect(page.getByText('Read only. Only the owner')).toBeVisible()
    await expect(page.getByLabel('UPI ID')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save settings' })).toHaveCount(0)
  })

  test('GSP credentials are write-only; test connection reports the result', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on('put', '/settings/einvoice-credentials', new Reply(204))
      .on('post', '/settings/einvoice-credentials/test', {
        ok: false,
        message: 'Invalid client secret',
      })
    await page.goto('/settings/einvoice')
    await page.getByLabel('Provider').fill('MasterGST')
    await page.getByLabel('Username').fill('shop_api')
    await page.getByLabel('Password').fill('s3cret')
    await page.getByRole('button', { name: 'Save credentials' }).click()
    await expect(page.getByText('Credentials saved')).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveValue('')
    await page.getByRole('button', { name: 'Test connection' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Could not connect. Invalid client secret' }),
    ).toBeVisible()
    expect(mock.calls('PUT', '/settings/einvoice-credentials')[0]!.body).toMatchObject({
      provider: 'MasterGST',
      environment: 'sandbox',
      username: 'shop_api',
      password: 's3cret',
    })
  })

  test('Tally ledger names and a new location', async ({ page, mock, signIn }) => {
    await signIn()
    mock
      .on('put', '/settings/tally-mapping', (r) => r.body as S['TallyMapping'])
      .on('post', '/locations', (r) => ({
        id: 4,
        ...(r.body as S['LocationInput']),
        is_active: true,
      }))
    await page.goto('/settings/tally')
    await page.getByLabel('Round-off ledger').fill('Rounding Off')
    await page.getByRole('button', { name: 'Save ledgers' }).click()
    await expect(page.getByText('Tally ledgers saved')).toBeVisible()
    expect(mock.calls('PUT', '/settings/tally-mapping')[0]!.body).toMatchObject({
      sales_ledger_cash: 'Sales - Cash',
      round_off_ledger: 'Rounding Off',
    })
    await page.getByRole('link', { name: 'Locations' }).click()
    await page.getByRole('button', { name: 'Add location' }).click()
    await page.getByRole('dialog').getByLabel('Name').fill('Godown 3')
    await page.getByRole('dialog').getByRole('button', { name: 'Add location' }).click()
    await expect(page.getByText('Location added')).toBeVisible()
    expect(mock.calls('POST', '/locations')[0]!.body).toEqual({
      name: 'Godown 3',
      kind: 'godown',
      is_default_billing: false,
    })
  })
})

test.describe('users (#39)', () => {
  const users: S['User'][] = [
    {
      id: data.superAdmin.id,
      full_name: 'Ramesh Kumar',
      email: 'owner@shop.test',
      role: 'super_admin',
      is_active: true,
      last_login_at: '2026-10-19T03:00:00Z',
    },
    {
      id: data.admin.id,
      full_name: 'Suresh B',
      email: 'counter@shop.test',
      role: 'admin',
      is_active: true,
    },
  ]

  test('invite, protect the last Super Admin, send a reset', async ({ page, mock, signIn }) => {
    await signIn()
    mock
      .on('get', '/users', users)
      .on('post', '/users', (r) => ({
        id: '00000000-0000-4000-8000-000000000009',
        is_active: true,
        ...(r.body as S['UserInvite']),
      }))
      .on('patch', '/users/{id}', problem(409, 'CONFLICT'))
      .on('post', '/users/{id}/password-reset', new Reply(204))
    await page.goto('/users')
    await page.getByRole('button', { name: 'Invite user' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Lakshmi N')
    await dialog.getByLabel('Email').fill('lakshmi@shop.test')
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    await expect(page.getByText('Invitation sent to lakshmi@shop.test')).toBeVisible()
    expect(mock.calls('POST', '/users')[0]!.body).toEqual({
      full_name: 'Lakshmi N',
      email: 'lakshmi@shop.test',
      role: 'admin',
    })

    await page.getByRole('button', { name: 'Actions for Ramesh Kumar' }).click()
    await expect(page.getByRole('menuitem', { name: 'Deactivate (yourself)' })).toBeDisabled()
    await page.getByRole('menuitem', { name: 'Edit name, mobile or role' }).click()
    await page.getByRole('dialog').getByLabel('Role').selectOption('admin')
    await page.getByRole('dialog').getByRole('button', { name: 'Save user' }).click()
    await expect(page.getByText('At least one active Super Admin must remain.')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Actions for Suresh B' }).click()
    await page.getByRole('menuitem', { name: 'Send password reset email' }).click()
    await page.getByRole('button', { name: 'Send email' }).click()
    await expect(page.getByText('Password reset sent to counter@shop.test')).toBeVisible()
  })

  test('Admin cannot open users or the audit log', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/users')
    await expect(page.getByText('user.manage')).toBeVisible()
    await page.goto('/audit-log')
    await expect(page.getByText('audit.view')).toBeVisible()
  })
})

test.describe('tally (#40) and audit log (#41)', () => {
  test('export runs as a job; an import preview with problems cannot be committed', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let previewIssues = true
    mock
      .on('post', '/tally/exports', {
        id: 'job-t',
        kind: 'tally_export',
        status: 'queued',
        progress: 0,
      })
      .on('get', '/jobs/{id}', {
        id: 'job-t',
        kind: 'tally_export',
        status: 'succeeded',
        progress: 100,
        result_url: 'https://storage.mock/tally.xml',
      })
      .on('post', '/tally/imports', () => ({
        import_id: 3,
        source: 'tally_xml' as const,
        cutover_date: '2026-10-19',
        counts: {
          items: { new: 120, existing: 4, errors: previewIssues ? 2 : 0 },
          customers: { new: 35, existing: 0, errors: 0 },
        },
        issues: previewIssues
          ? [
              {
                entity: 'item',
                name: 'TMT 10mm',
                problem: 'Unit "Qtl" is not set up',
                suggestion: 'Add the unit, or map it to kg',
              },
            ]
          : [],
        expires_at: '2026-10-19T12:00:00Z',
      }))
      .on('post', '/tally/imports/{id}/commit', {
        id: 'job-i',
        kind: 'tally_import',
        status: 'succeeded',
        progress: 100,
      })
    await page.goto('/tally')
    await page.getByRole('checkbox', { name: 'Payments to dealers' }).uncheck()
    await page.getByRole('button', { name: 'Export to Tally XML' }).click()
    await expect(page.getByRole('button', { name: 'Download result' })).toBeVisible()
    const body = mock.calls('POST', '/tally/exports')[0]!.body as S['TallyExportInput']
    expect(body.scope).toEqual(['masters', 'sales', 'credit_notes', 'receipts', 'purchases'])

    await page.getByRole('tab', { name: 'Import' }).click()
    await page.getByLabel('Tally export (XML or Excel)').setInputFiles({
      name: 'tally.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from('<ENVELOPE/>'),
    })
    await page.getByRole('button', { name: 'Upload and preview' }).click()
    const preview = page.getByRole('region', { name: 'Import preview' })
    await expect(preview).toContainText('Unit "Qtl" is not set up')
    await expect(preview.getByRole('button', { name: 'Import into the app' })).toBeDisabled()
    previewIssues = false
    await page.getByRole('button', { name: 'Upload and preview' }).click()
    await expect(preview.getByRole('button', { name: 'Import into the app' })).toBeEnabled()
    await preview.getByRole('button', { name: 'Import into the app' }).click()
    await expect(preview.getByText('Import finished.')).toBeVisible()
    expect(String(mock.calls('POST', '/tally/imports')[0]!.body)).toContain('name="cutover_date"')
  })

  test('audit entries show what changed', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on(
      'get',
      '/audit-log',
      data.page<S['AuditEntry']>([
        {
          id: 1,
          user_name: 'Ramesh Kumar',
          action: 'edit',
          entity: 'bill',
          entity_id: 1052,
          before: { grand_total: '148450.00', version: 1 } as never,
          after: { grand_total: '150130.00', version: 2 } as never,
          created_at: '2026-10-19T05:00:00Z',
        },
      ]),
    )
    await page.goto('/audit-log')
    await page.getByText('edit', { exact: true }).click()
    const entry = page.getByRole('list', { name: 'Audit entries' })
    await expect(entry).toContainText('grand_total')
    await expect(entry).toContainText('"150130.00"')
    await page.getByRole('searchbox', { name: 'Entity' }).fill('bill')
    await expect
      .poll(() => mock.calls('GET', '/audit-log').at(-1)?.query.get('entity'))
      .toBe('bill')
  })
})
