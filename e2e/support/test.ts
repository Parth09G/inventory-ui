import { test as base, expect } from '@playwright/test'
import * as data from './data'
import { MockApi, session } from './mock-api'

type Fixtures = {
  mock: MockApi
  /** Starts the page already signed in as this user (session pre-seeded in storage). */
  signIn: (user?: typeof data.superAdmin) => Promise<void>
}

export const test = base.extend<Fixtures>({
  mock: async ({ page }, use) => {
    const mock = new MockApi(page)
    await mock.install()
    await use(mock)
    expect(mock.unhandled, 'API calls with no mock handler').toEqual([])
  },
  signIn: async ({ page, mock }, use) => {
    await use(async (user = data.superAdmin) => {
      mock.me = user
      // Seed once per tab, so a later sign-out in the test is not undone by the next navigation.
      await page.addInitScript((s) => {
        if (sessionStorage.getItem('e2e-seeded')) return
        sessionStorage.setItem('e2e-seeded', '1')
        localStorage.setItem('billing-auth', JSON.stringify(s))
      }, session(user))
    })
  },
})

export { expect }
export { data }
