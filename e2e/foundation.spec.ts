import { PASSWORD, problem, Reply } from './support/mock-api'
import { data, expect, test } from './support/test'

test.describe('sign in', () => {
  test('redirects to sign in, then back to the requested page', async ({ page, mock }) => {
    void mock
    await page.goto('/no-access?perm=x')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('Email').fill(data.superAdmin.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/no-access\?perm=x/)
    await expect(
      page.getByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeVisible()
  })

  test('shows a clear error for a wrong password', async ({ page, mock }) => {
    void mock
    await page.goto('/login')
    await page.getByLabel('Email').fill(data.admin.email)
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
  })

  test('validates fields before calling the server', async ({ page, mock }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
    expect(mock.requests).toHaveLength(0)
  })

  test('a deactivated user is signed out with an explanation', async ({ page, mock }) => {
    mock.on('get', '/me', problem(401, 'UNAUTHENTICATED'))
    await page.goto('/login')
    await page.getByLabel('Email').fill(data.admin.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText('Your access was removed')
    await expect(page).toHaveURL(/\/login/)
  })

  test('an expired session on any API call returns to sign in', async ({ page, mock, signIn }) => {
    await signIn()
    mock.on('get', '/notifications', problem(401, 'UNAUTHENTICATED'))
    await page.goto('/')
    await expect(page).toHaveURL(/\/login\?reason=expired/)
    await expect(page.getByRole('alert')).toHaveText('Your session ended. Sign in again.')
  })

  test('a signed-in user visiting /login goes to the dashboard', async ({ page, signIn }) => {
    await signIn()
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})

test.describe('passwords', () => {
  test('forgot password always shows the same confirmation', async ({ page, mock }) => {
    void mock
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('nobody@shop.test')
    await page.getByRole('button', { name: 'Send link' }).click()
    await expect(page.getByRole('status')).toContainText(
      'If an account exists for nobody@shop.test',
    )
  })

  test('set password without a link session says the link expired', async ({ page, mock }) => {
    void mock
    await page.goto('/set-password')
    await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible()
  })

  test('set password enforces the policy, then signs in', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/set-password')
    await page.getByLabel('New password').fill('short')
    await page.getByLabel('Confirm password').fill('different')
    await page.getByRole('button', { name: 'Save password' }).click()
    await expect(page.getByText('At least 10 characters')).toBeVisible()
    await expect(page.getByText('The passwords do not match')).toBeVisible()
    await page.getByLabel('New password').fill('NewPassw0rd')
    await page.getByLabel('Confirm password').fill('NewPassw0rd')
    await page.getByRole('button', { name: 'Save password' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})

test.describe('system screens', () => {
  test('unknown address shows 404', async ({ page, signIn }) => {
    await signIn()
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })

  test('403 names the missing permission', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/no-access?perm=settings.manage')
    await expect(page.getByText('settings.manage')).toBeVisible()
  })
})

test.describe('app shell', () => {
  test('desktop has the sidebar; phone has the bottom bar', async ({ page, signIn, isMobile }) => {
    await signIn()
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav).toBeVisible()
    if (isMobile) {
      await expect(nav.getByRole('button', { name: 'More' })).toBeVisible()
      await nav.getByRole('button', { name: 'More' }).click()
      await expect(page.getByRole('heading', { name: 'All pages' })).toBeVisible()
    } else {
      await nav.getByRole('button', { name: 'Collapse sidebar' }).click()
      await expect(nav.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    }
    // No horizontal scroll at any width (NFR-06).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('Ctrl+K opens search and shows server results', async ({ page, mock, signIn, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut is desktop-only')
    await signIn()
    mock.on('get', '/search', (req) =>
      req.query.get('q') === 'tmt'
        ? {
            items: [{ id: 41, name: 'TMT 12 mm JSW', stock_total: '1500.000' }],
            parties: [],
            bills: [],
          }
        : { items: [], parties: [], bills: [] },
    )
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder(/Search items/).fill('tmt')
    await expect(page.getByRole('option', { name: /TMT 12 mm JSW/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /TMT 12 mm JSW/ })).toContainText(
      '1,500 in stock',
    )
    await page.keyboard.press('Escape')
    await page.keyboard.press('?')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
  })

  test('notification bell shows unread count and marks all read', async ({
    page,
    mock,
    signIn,
  }) => {
    await signIn()
    let unread = 2
    mock
      .on('get', '/notifications', () => ({
        data: Array.from({ length: unread }, (_, i) => ({
          id: i + 1,
          kind: 'stock_short' as const,
          title: `Shortage: JSW 12 mm at Shop (${i + 1})`,
          body: 'Required 500 kg, available 120 kg',
          is_read: false,
          created_at: '2026-10-18T09:35:00Z',
        })),
        meta: { page: 1, page_size: 10, total: unread },
      }))
      .on('post', '/notifications/read-all', () => {
        unread = 0
        return new Reply(204)
      })
    await page.goto('/')
    const bell = page.getByRole('button', { name: 'Notifications, 2 unread' })
    await bell.click()
    await expect(page.getByText('Shortage: JSW 12 mm at Shop (1)')).toBeVisible()
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(page.getByText('No unread notifications.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notifications, 0 unread' })).toBeVisible()
  })

  test('user menu: density and sign out', async ({ page, signIn }) => {
    await signIn(data.admin)
    await page.goto('/')
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(page.getByText('Admin · counter@shop.test')).toBeVisible()
    await page.getByRole('menuitemradio', { name: 'Comfortable' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable')
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('offline banner appears when the connection drops', async ({ page, context, signIn }) => {
    await signIn()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await context.setOffline(true)
    await expect(page.getByText('Offline – billing needs internet')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('Offline – billing needs internet')).toBeHidden()
  })
})
