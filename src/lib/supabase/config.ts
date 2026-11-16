/**
 * Public Supabase configuration — safe for the browser, Edge middleware and server.
 *
 * Variable names (new API key format):
 *   NEXT_PUBLIC_SUPABASE_URL              project URL (public)
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  sb_publishable_… key (public, RLS-enforced)
 *
 * Transitional fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy name) is still read
 * when the publishable key is not set, so existing deployments keep working while
 * the environment is migrated. Remove it once every environment uses the new name.
 *
 * NOTE: Next.js only inlines NEXT_PUBLIC_* variables into browser bundles when they
 * are referenced literally as `process.env.NAME`, so do not refactor these into
 * dynamic lookups. Secrets never live here — see `@/lib/supabase/admin`.
 */

/**
 * Project URL used by every SESSION client (browser, server components/route
 * handlers, middleware). They must all use the same URL because @supabase/ssr derives
 * the auth cookie name from it; a different URL on the server would not see the
 * browser's session.
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined
}

/** Publishable (client) key. Falls back to the legacy anon key name. */
export function getSupabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined
}

const PLACEHOLDER_KEYS = new Set(['your-anon-key', 'your-publishable-key', 'sb_publishable_your-key'])

/**
 * True when the public URL and publishable key are present and not the example
 * placeholders. Safe to call from the browser, Edge middleware and server code.
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key) return false
  if (url.includes('your-project') || PLACEHOLDER_KEYS.has(key)) return false
  return true
}

/** Returns the public config or throws a clear error (used when constructing clients). */
export function requirePublicSupabaseConfig(): { url: string; publishableKey: string } {
  const url = getSupabaseUrl()
  const publishableKey = getSupabasePublishableKey()
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }
  return { url, publishableKey }
}
