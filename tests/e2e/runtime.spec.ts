import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

/** Collects uncaught exceptions and console errors (incl. React hydration errors). */
function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Expected: Supabase requests are aborted by the fixture (or the host does not
    // resolve), so the browser logs the failed network request itself.
    if (/Failed to load resource|ERR_NAME_NOT_RESOLVED|net::ERR_/i.test(text)) return
    // supabase-js logs the underlying fetch failure itself before returning an
    // error object; the app handles that error (asserted separately via the UI).
    if (/^TypeError: Failed to fetch(\n|$)/.test(text)) return
    errors.push(`console: ${text}`)
  })
  return errors
}

test.describe('no runtime / hydration errors', () => {
  for (const path of ['/login', '/forgot-password', '/reset-password', '/login?error=inactive', '/login?reset=success']) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors = trackErrors(page)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(errors).toEqual([])
    })
  }

  test('login submit with unreachable auth service has no uncaught errors', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/login')
    await page.getByLabel('Email Address').fill('someone@example.com')
    await page.getByLabel('Password').fill('wrong-password-123')
    await page.getByRole('button', { name: /Access Dashboard/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: /\w/ }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('forgot-password failure path has no uncaught errors', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/forgot-password')
    await page.getByLabel('Registered Email').fill('someone@example.com')
    await page.getByRole('button', { name: /Send Recovery Link/ }).click()
    await expect(page.getByText('Could not send recovery email')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('static files are not redirected to login (regression: middleware rewrite)', async ({ request }) => {
  const res = await request.get('/robots.txt', { maxRedirects: 0 })
  // There is no public/robots.txt, so 404 is correct — the point is "not a 307 to /login".
  expect(res.status()).not.toBe(307)
  expect(res.headers()['location']).toBeUndefined()
})
