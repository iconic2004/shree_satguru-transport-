import { test, expect } from './fixtures'

test.describe('route protection (unauthenticated)', () => {
  for (const path of ['/', '/dashboard', '/billing', '/admin/users', '/staff/payroll']) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByRole('heading', { name: 'Shree Satguru Transport' })).toBeVisible()
    })
  }

  test('redirectTo preserves the requested page', async ({ page }) => {
    await page.goto('/billing')
    expect(new URL(page.url()).searchParams.get('redirectTo')).toBe('/billing')
  })

  test('anonymous API access is rejected (regression: /api/goods was open)', async ({ request }) => {
    const res = await request.get('/api/goods')
    expect(res.status()).toBe(401)
    const post = await request.post('/api/goods', { data: { invoice_number: 'X' } })
    expect(post.status()).toBe(401)
    const users = await request.get('/api/admin/users')
    expect(users.status()).toBe(401)
  })

  test('security headers are sent', async ({ request }) => {
    const res = await request.get('/login')
    expect(res.headers()['x-frame-options']).toBe('DENY')
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
    expect(res.headers()['x-powered-by']).toBeUndefined()
  })
})

test.describe('login', () => {
  test('failed sign-in shows an error and does NOT enter the app (regression: any credentials were accepted)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email Address').fill('someone@example.com')
    await page.getByLabel('Password').fill('wrong-password-123')
    await page.getByRole('button', { name: /Access Dashboard/ }).click()

    // Unreachable auth service in this environment -> network error message;
    // with a live project it would be "Invalid email or password."
    await expect(
      page.getByRole('alert').filter({ hasText: /Invalid email or password|Unable to reach the server|unavailable/i })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/Logged in successfully/i)).toHaveCount(0)
  })

  test('empty form is blocked by native validation', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Access Dashboard/ }).click()
    await expect(page).toHaveURL(/\/login/)
    const valid = await page.getByLabel('Email Address').evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(valid).toBe(false)
  })

  test('demo shortcuts and hard-coded passwords are hidden by default', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/Demo accounts/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Super Admin' })).toHaveCount(0)
    expect(await page.content()).not.toContain('Demo@12345')
  })

  test('shows a clear message for expired / invalid email links', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page).toHaveURL(/\/login\?error=link/)
    await expect(page.getByRole('alert').filter({ hasText: /invalid or has expired/i })).toBeVisible()
  })

  test('shows a message for deactivated accounts', async ({ page }) => {
    await page.goto('/login?error=inactive')
    await expect(page.getByRole('alert').filter({ hasText: /inactive/i })).toBeVisible()
  })

  test('ignores an external redirectTo after login attempt (open-redirect guard)', async ({ page }) => {
    await page.goto('/login?redirectTo=https://evil.example.com')
    await expect(page).toHaveURL(/\/login/)
    // The page must not navigate anywhere on load.
    await page.waitForTimeout(500)
    expect(new URL(page.url()).host).toContain('localhost')
  })
})

test.describe('password recovery', () => {
  test('forgot-password reports a failure instead of pretending the email was sent', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Registered Email').fill('someone@example.com')
    await page.getByRole('button', { name: /Send Recovery Link/ }).click()
    // With an unreachable auth service the request fails; previously the page
    // still showed "Check Your Email".
    await expect(page.getByText('Could not send recovery email')).toBeVisible()
    await expect(page.getByText('Check Your Email')).toHaveCount(0)
  })

  test('reset-password without a recovery session explains the link is invalid', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Request a new link/ })).toBeVisible()
  })
})

test.describe('responsive layout', () => {
  for (const path of ['/login', '/forgot-password', '/reset-password']) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
