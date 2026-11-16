import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests run against the PRODUCTION build (`next start`).
 *
 * By default they use placeholder Supabase credentials, so only flows that do not
 * need a live database are exercised (redirects, auth error handling, layout).
 * To run against a real (non-production!) Supabase project, set E2E_BASE_URL to an
 * already-running server instead.
 */
const PORT = Number(process.env.E2E_PORT || 3100)
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        // honours NEXT_DIST_DIR when the build was made into a separate folder
        url: `${baseURL}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-test.supabase.co',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_placeholder',
          NEXT_TELEMETRY_DISABLED: '1',
          NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next',
        },
      },
})
