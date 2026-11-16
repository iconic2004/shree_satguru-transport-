import { test as base, expect } from '@playwright/test'

/**
 * Browser tests must never send traffic to a real Supabase project (they can be
 * run against a build that inlined real .env.local values). Every browser request
 * to Supabase is aborted, which also makes the "service unavailable" paths
 * deterministic. Server-side code exercised by these tests makes no Supabase
 * calls without a session cookie.
 */
export const test = base.extend<{ blockSupabase: void }>({
  blockSupabase: [
    async ({ page }, use) => {
      await page.route(/\.supabase\.(co|in)\//, route => route.abort('internetdisconnected'))
      await use()
    },
    { auto: true },
  ],
})

export { expect }
