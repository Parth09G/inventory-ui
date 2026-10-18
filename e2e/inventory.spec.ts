import { file, problem } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

const steel = data.categories[1]!

test.describe('inventory (#19)', () => {
  test.beforeEach(async ({ mock }) => {
    // Hovering a row preloads its item page (router preload on intent).
    mock.on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
    mock.on('get', '/categories', data.categories).on('get', '/items', (r) => {
      const status = r.query.get('stock_status')
      const rows = status ? data.items.filter((i) => i.stock_status === status) : data.items
      return data.page(rows, Number(r.query.get('page') ?? 1), status ? rows.length : 120)
    })
  })

  test('shows stock per location and filters through the URL', async ({
    page,
    mock,
    signIn,
    isMobile,
  }) => {
    await signIn()
    await page.goto('/inventory')
    if (!isMobile) {
      const table = page.getByRole('table', { name: 'Inventory' })
      const row = table.getByRole('row', { name: /JSW 12 mm/ })
      await expect(row).toContainText('1,500')
      await expect(row).toContainText('1,620')
      await expect(table.getByRole('row', { name: /ACC PPC/ })).toContainText('Out of stock')
      await table.getByRole('button', { name: 'Total' }).click()
      await expect(page).toHaveURL(/sort=stock_total/)
      await table.getByRole('button', { name: 'Total' }).click()
      await expect(page).toHaveURL(/sort=-stock_total/)
    } else {
      await expect(
        page.getByRole('list', { name: 'Inventory' }).getByText('JSW 12 mm'),
      ).toBeVisible()
    }

    await page.getByLabel('Category').selectOption({ label: 'Steel' })
    await expect(page).toHaveURL(/category_id=2/)
    const brand = page.getByRole('textbox', { name: 'Brand' })
    await brand.fill('JSW')
    await brand.press('Enter')
    await expect.poll(() => mock.requests.at(-1)?.query.get('attr[brand]')).toBe('JSW')
    await page.getByLabel('Stock', { exact: true }).selectOption('low')
    await expect.poll(() => mock.requests.at(-1)?.query.get('stock_status')).toBe('low')
    await expect(page.getByText('UltraTech OPC 53')).toBeVisible()
    await expect(page.getByText('JSW 12 mm')).toBeHidden()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    // Sorting is not a filter, so it stays.
    await expect(page).toHaveURL(/\/inventory(\?sort=-stock_total)?$/)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText('51–100 of 120')).toBeVisible()
  })
})

test.describe('items (#20, #21)', () => {
  test.beforeEach(async ({ mock }) => {
    mock
      .on('get', '/categories', data.categories)
      .on('get', '/items', data.page(data.items))
      .on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
      .on('get', '/items/{id}/movements', (r) =>
        data.page<S['StockMovement']>(
          [
            {
              id: 2,
              date: '2026-10-12',
              kind: 'sale',
              qty_in: '0.000',
              qty_out: '380.000',
              balance: '1620.000',
              location_id: 1,
              location_name: 'Shop',
              ref_no: 'C/26-27/0417',
              user_name: 'Suresh B',
            },
            {
              id: 1,
              date: '2026-10-01',
              kind: 'purchase',
              qty_in: '2000.000',
              qty_out: '0.000',
              balance: '2000.000',
              location_id: 2,
              location_name: 'Godown 1',
              ref_no: 'P/26-27/0031',
              user_name: 'Ramesh Kumar',
            },
          ],
          1,
          r.query.get('page_size') === '1' ? 2 : 2,
        ),
      )
  })

  test('item page shows stock, units and the stock ledger', async ({ page, mock, signIn }) => {
    await signIn()
    await page.goto('/items/41')
    await expect(page.getByRole('heading', { name: 'JSW 12 mm' })).toBeVisible()
    const stock = page.getByRole('region', { name: 'Stock by location' })
    await expect(stock).toContainText('Godown 1')
    await expect(stock).toContainText('1,500 kg')
    await expect(page.getByText('1 ton = 1,000 kg')).toBeVisible()
    await page.getByRole('tab', { name: 'Stock ledger' }).click()
    await expect(page.getByText('C/26-27/0417')).toBeVisible()
    await page.getByLabel('Location', { exact: true }).selectOption({ label: 'Godown 1' })
    await expect
      .poll(() => mock.calls('GET', '/items/41/movements').at(-1)?.query.get('location_id'))
      .toBe('2')
  })

  test('creates an item with attributes, a second unit and opening stock', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    mock.on('post', '/items', (r) => ({ ...data.items[0]!, id: 77, name: 'JSW 16 mm', ...r.body }))
    mock.on('get', '/items/{id}', (r) => ({
      ...data.items[0]!,
      id: Number(r.params.id),
      name: 'JSW 16 mm',
    }))
    await page.goto('/inventory')
    await page.getByRole('link', { name: 'New item' }).click()
    await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible()
    await page.getByLabel('Category').selectOption({ label: 'Steel' })
    await expect(page.getByLabel('HSN')).toHaveValue('7214')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByText('Enter brand')).toBeVisible()
    await page.getByLabel('Brand').fill('JSW')
    await page.getByLabel(/^Size/).fill('16')
    await expect(page.getByText('Leave blank to use “JSW 16 mm”.')).toBeVisible()
    await page.getByRole('button', { name: 'Add unit' }).click()
    await page.getByLabel('Unit 1', { exact: true }).selectOption({ label: 'Tonne' })
    await page.getByLabel('Factor for unit 1').fill('1000')
    await page.getByLabel('Reorder level (kg)').fill('500')
    await page.getByLabel('Opening quantity at Godown 1').fill('2000')
    await page.getByLabel('Opening cost at Godown 1').fill('61.75')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByText('JSW 16 mm added')).toBeVisible()
    await expect(page).toHaveURL(/\/items\/77$/)
    expect(mock.calls('POST', '/items')[0]!.body).toEqual({
      category_id: 2,
      attributes: { brand: 'JSW', size: '16' },
      hsn_code: '7214',
      gst_rate: '18',
      base_unit_id: 2,
      units: [{ unit_id: 3, factor_to_base: '1000' }],
      reorder_level: '500',
      opening_stock: [{ location_id: 2, qty: '2000', unit_cost: '61.75' }],
    })
  })

  test('duplicate attributes are reported on the name', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('post', '/items', problem(409, 'DUPLICATE'))
    await page.goto(`/items/new?category_id=${steel.id}`)
    await page.getByLabel('Brand').fill('JSW')
    await page.getByLabel(/^Size/).fill('12')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(
      page.getByText('An item with the same category and attributes already exists'),
    ).toBeVisible()
  })

  test('an item with movements keeps its units fixed but can add new ones', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('patch', '/items/{id}', (r) => ({ ...data.items[0]!, ...r.body }) as S['Item'])
    await page.goto('/items/41/edit')
    await expect(page.getByText('This item has stock movements')).toBeVisible()
    await expect(page.getByLabel('Base unit')).toBeDisabled()
    await expect(page.getByLabel('Factor for unit 1')).toBeDisabled()
    await expect(page.getByLabel('Category')).toBeDisabled()
    await page.getByLabel('Reorder level (kg)').fill('750')
    await page.getByRole('button', { name: 'Save item' }).click()
    await expect(page).toHaveURL(/\/items\/41$/)
    expect(mock.calls('PATCH', '/items/41')[0]!.body).toMatchObject({
      reorder_level: '750',
      units: [{ unit_id: 3, factor_to_base: '1000' }],
    })
  })

  test('only Super Admin can deactivate', async ({ page, mock, signIn }) => {
    await signIn(data.admin)
    await page.goto('/items/41')
    await expect(page.getByRole('heading', { name: 'JSW 12 mm' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
    void mock
  })
})

test('item import: template download, upload and job progress (#22)', async ({
  page,
  mock,
  signIn,
}) => {
  await signIn()
  let polls = 0
  mock
    .on('get', '/categories', data.categories)
    .on(
      'get',
      '/categories/{id}/import-template',
      file('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'PK-xlsx'),
    )
    .on('post', '/items/import', {
      id: 'job-1',
      kind: 'item_import',
      status: 'queued',
      progress: 0,
    })
    .on('get', '/jobs/{id}', () => {
      polls++
      return polls < 2
        ? { id: 'job-1', kind: 'item_import' as const, status: 'running' as const, progress: 60 }
        : { id: 'job-1', kind: 'item_import' as const, status: 'succeeded' as const, progress: 100 }
    })
    .on('get', '/items', data.page(data.items))
  await page.goto('/items/import')
  await page.getByLabel('Category').selectOption({ label: 'Steel' })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download template' }).click()
  expect((await download).suggestedFilename()).toBe('Steel import template.xlsx')

  await page.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'steel.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('PK-filled'),
  })
  await page.getByRole('button', { name: 'Import items' }).click()
  await expect(page.getByText('Import finished.')).toBeVisible({ timeout: 10_000 })
  const upload = mock.calls('POST', '/items/import')[0]!
  expect(upload.headers['content-type']).toMatch(/multipart\/form-data/)
  expect(String(upload.body)).toContain('name="category_id"')
  await page.getByRole('link', { name: 'Check the Steel items' }).click()
  await expect(page).toHaveURL(/\/inventory\?category_id=2/)
})
