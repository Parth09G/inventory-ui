import { problem, Reply } from './support/mock-api'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

test.describe('categories (#33, #34)', () => {
  test.beforeEach(async ({ mock }) => {
    mock
      .on('get', '/categories', data.categories)
      .on('get', '/categories/{id}', (r) =>
        data.categories.find((c) => c.id === Number(r.params.id))!,
      )
  })

  test('lists categories with units and attributes; a row opens the editor', async ({
    page,
    signIn,
  }) => {
    await signIn()
    await page.goto('/catalogue/categories')
    const table = page
      .getByRole('table', { name: 'Categories' })
      .or(page.getByRole('list', { name: 'Categories' }))
    await expect(table.getByText('Steel')).toBeVisible()
    await expect(table.getByText('Tiles (old)')).toBeVisible()
    await table.getByText('Steel').click()
    await expect(page.getByRole('heading', { name: 'Steel' })).toBeVisible()
    await expect(page.getByLabel('Default HSN')).toHaveValue('7214')
    await expect(page.getByRole('list', { name: 'Attributes' }).getByText(/^Size/)).toBeVisible()
  })

  test('wizard creates a category with units and ordered attributes', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn(data.admin)
    let created: S['Category'] | undefined
    mock
      .on('post', '/categories', (r) => {
        created = { id: 9, is_active: true, item_count: 0, ...r.body, units: [], attributes: [] }
        return created!
      })
      .on('get', '/categories/{id}', () => created!)
    await page.goto('/catalogue/categories/new')

    // Step 1: name is required.
    await page.getByRole('button', { name: 'Next: Units' }).click()
    await expect(page.getByText('Enter a name')).toBeVisible()
    await page.getByLabel('Category name').fill('Steel pipes')
    await page.getByLabel('Default HSN').fill('7306')
    await page.getByRole('button', { name: 'Next: Units' }).click()

    // Step 2: at least one unit.
    await page.getByRole('button', { name: 'Next: Attributes' }).click()
    await expect(page.getByText('Choose at least one unit')).toBeVisible()
    await page.getByRole('checkbox', { name: /Numbers/ }).check()
    await page.getByRole('checkbox', { name: /Kilogram/ }).check()
    await page.getByRole('radio', { name: 'Kilogram is the default unit' }).check()
    await page.getByRole('button', { name: 'Next: Attributes' }).click()

    // Step 3: attributes, a pick-list needs two options.
    await page.getByRole('button', { name: 'Add attribute' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Label').fill('Shape')
    await expect(dialog.getByLabel('Code')).toHaveValue('shape')
    await dialog.getByLabel('Type').selectOption('select')
    await dialog.getByLabel('Options').fill('Round')
    await dialog.getByRole('button', { name: 'Add attribute' }).click()
    await expect(dialog.getByText('A pick-list needs at least two options')).toBeVisible()
    await dialog.getByLabel('Options').fill('Round, Square, Rectangular')
    await dialog.getByRole('button', { name: 'Add attribute' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'Add attribute' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Label').fill('Size')
    await dialog.getByLabel('Unit of value').fill('inch')
    await dialog.getByRole('button', { name: 'Add attribute' }).click()
    await page.getByRole('button', { name: 'Move Size up' }).click()
    await page.getByRole('button', { name: 'Next: Review' }).click()

    await expect(
      page
        .getByText('Kilogram (default), Numbers')
        .or(page.getByText('Numbers, Kilogram (default)')),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Create category' }).click()
    await expect(page.getByText('Category Steel pipes created')).toBeVisible()
    await expect(page).toHaveURL(/\/catalogue\/categories\/9$/)

    const body = mock.calls('POST', '/categories')[0]!.body as S['CategoryInput']
    expect(body).toMatchObject({ name: 'Steel pipes', default_hsn: '7306', default_gst: '18' })
    expect(body.units).toEqual([
      { unit_id: 4, is_default: false },
      { unit_id: 2, is_default: true },
    ])
    expect(
      body.attributes!.map((a) => [a.code, a.sort_order, a.data_type, a.options, a.value_unit]),
    ).toEqual([
      ['size', 1, 'text', undefined, 'inch'],
      ['shape', 2, 'select', ['Round', 'Square', 'Rectangular'], null],
    ])
  })

  test('editor saves details without touching attributes, and adds an attribute', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock
      .on(
        'patch',
        '/categories/{id}',
        (r) => ({ ...data.categories[1]!, ...r.body }) as S['Category'],
      )
      .on('post', '/categories/{id}/attributes', (r) => ({ id: 23, ...r.body }))
    await page.goto('/catalogue/categories/2')
    const save = page.getByRole('button', { name: 'Save category' })
    await expect(save).toBeDisabled()
    await page.getByLabel('Default GST rate').selectOption('28')
    await save.click()
    await expect(page.getByText('Category saved')).toBeVisible()
    const patch = mock.calls('PATCH', '/categories/2')[0]!.body as S['CategoryInput']
    expect(patch.default_gst).toBe('28')
    expect(patch.attributes).toBeUndefined()

    await page.getByRole('button', { name: 'Add attribute' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Label').fill('Brand')
    await dialog.getByRole('button', { name: 'Add attribute' }).click()
    await expect(dialog.getByText('Another attribute already uses this code')).toBeVisible()
    await dialog.getByLabel('Label').fill('Grade')
    await dialog.getByLabel('Code').fill('grade')
    await dialog.getByRole('button', { name: 'Add attribute' }).click()
    await expect(dialog).toBeHidden()
    expect(mock.calls('POST', '/categories/2/attributes')[0]!.body).toMatchObject({
      code: 'grade',
      sort_order: 3,
    })
  })

  test('deactivating a category with active items explains why it failed', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('post', '/categories/{id}/deactivate', problem(409, 'INVALID_STATE'))
    await page.goto('/catalogue/categories/1')
    await page.getByRole('button', { name: 'Deactivate' }).click()
    await page.getByRole('button', { name: 'Deactivate category' }).click()
    await expect(page.getByText('This category still has active items')).toBeVisible()
  })

  test('Super Admin can remove an unused attribute; Admin cannot see the action', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    mock.on('delete', '/categories/{id}/attributes/{attrId}', new Reply(204))
    await page.goto('/catalogue/categories/1')
    await page.getByRole('button', { name: 'Remove Grade' }).click()
    await page.getByRole('button', { name: 'Remove attribute' }).click()
    await expect(page.getByText('Attribute removed')).toBeVisible()
    expect(mock.calls('DELETE', '/categories/1/attributes/12')).toHaveLength(1)
  })

  test('Admin sees no deactivate or remove actions', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/catalogue/categories/1')
    await expect(page.getByRole('heading', { name: 'Cement' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  })
})
