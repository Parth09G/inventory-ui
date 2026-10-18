import { problem } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

test.describe('units (#35)', () => {
  test('lists units and adds a new one', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    const units: S['Unit'][] = [...data.units]
    mock
      .on('get', '/units', () => units)
      .on('post', '/units', (req) => {
        const u = { id: 99, ...req.body } as S['Unit']
        units.push(u)
        return u
      })
    await page.goto('/catalogue/units')
    await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible()
    await expect(page.getByText('Kilogram')).toBeVisible()

    await page.getByRole('button', { name: 'Add unit' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Bundle')
    await dialog.getByLabel('Symbol').fill('bdl')
    await dialog.getByLabel('GST UQC').fill('bdl')
    await dialog.getByLabel('Decimal places').selectOption('0')
    await dialog.getByRole('button', { name: 'Add unit' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Unit Bundle added')).toBeVisible()
    await expect(page.getByText('Bundle', { exact: true })).toBeVisible()
    expect(mock.calls('POST', '/units')[0]!.body).toEqual({
      name: 'Bundle',
      symbol: 'bdl',
      uqc_code: 'BDL',
      decimals: 0,
    })
  })

  test('validates input and shows a duplicate symbol on the field', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('post', '/units', problem(409, 'DUPLICATE'))
    await page.goto('/catalogue/units')
    await page.getByRole('button', { name: 'Add unit' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Add unit' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()
    await expect(mock.calls('POST', '/units')).toHaveLength(0)
    await dialog.getByLabel('Name').fill('Kilogram')
    await dialog.getByLabel('Symbol').fill('kg')
    await dialog.getByRole('button', { name: 'Add unit' }).click()
    await expect(dialog.getByText('A unit with this symbol already exists')).toBeVisible()
    await expect(dialog.getByLabel('Symbol')).toBeFocused()
  })

  test('edits a unit', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('patch', '/units/{id}', (req) => ({ id: Number(req.params.id), ...req.body }))
    await page.goto('/catalogue/units')
    await page.getByRole('button', { name: 'Edit Tonne' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Symbol')).toHaveValue('ton')
    await dialog.getByLabel('Name').fill('Metric tonne')
    await dialog.getByRole('button', { name: 'Save unit' }).click()
    await expect(dialog).toBeHidden()
    expect(mock.calls('PATCH', '/units/3')[0]!.body).toMatchObject({
      name: 'Metric tonne',
      symbol: 'ton',
      decimals: 3,
    })
  })
})
