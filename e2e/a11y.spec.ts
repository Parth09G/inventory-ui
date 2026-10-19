import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { billFrom, calculate } from './support/billing'
import { data, expect, test } from './support/test'
import type { S } from './support/types'

/** WCAG 2.2 AA scan of a page (design P11). Failures list rule, element and fix hint. */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')} — ${v.help}`,
  )
}

test.beforeEach(async ({ mock }) => {
  mock
    .on('get', '/settings', data.settings)
    .on('get', '/categories', data.categories)
    .on('get', '/items', data.page(data.items))
    .on('get', '/items/{id}', (r) => data.items.find((i) => i.id === Number(r.params.id))!)
    .on('get', '/items/{id}/movements', data.page<S['StockMovement']>([]))
    .on('get', '/parties', data.page(data.parties))
    .on('get', '/parties/{id}', (r) => data.parties.find((p) => p.id === Number(r.params.id))!)
    .on('get', '/parties/{id}/ledger', data.ledger)
    .on('get', '/bills', data.page<S['BillSummary']>([]))
    .on('post', '/bills/calculate', (r) => calculate(r.body as S['BillInput']))
    .on(
      'get',
      '/bills/{id}',
      billFrom({
        bill_type: 'cash',
        status: 'active',
        customer: { party_id: 7 },
        place_of_supply: '29',
        lines: [{ item_id: 41, location_id: 1, qty: '10', unit_id: 2, rate: '68' }],
      }),
    )
    .on('get', '/items/{id}/price-hints', { recent_rates: [], avg_cost: '62.5000' })
})

test('sign-in page', async ({ page, mock }) => {
  void mock
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Enter your password')).toBeVisible()
  expect(await scan(page)).toEqual([])
})

const pages: [string, string, RegExp][] = [
  ['dashboard', '/', /Dashboard/],
  ['bills', '/bills', /Bills/],
  ['bill editor', '/bills/new', /New Cash bill/],
  ['bill view', '/bills/1052', /Cash bill/],
  ['inventory', '/inventory', /Inventory/],
  ['item', '/items/41', /JSW 12 mm/],
  ['party', '/parties/7', /Ravi Builders/],
  ['settings', '/settings/shop', /Settings/],
  ['reports', '/reports', /Reports/],
]

for (const [name, url, heading] of pages)
  test(`${name} has no WCAG AA violations`, async ({ page, signIn }) => {
    await signIn()
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await scan(page)).toEqual([])
    // NFR-06: the page itself never scrolls sideways (wide tables scroll inside their own box).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0)
  })
