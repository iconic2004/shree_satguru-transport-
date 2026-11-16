import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/types/database'
import { requirePublicSupabaseConfig } from '@/lib/supabase/config'

/**
 * Server (route handler / server component) client acting AS THE SIGNED-IN USER.
 * Uses the publishable key + the user's session cookie, so RLS applies. It must use
 * the same URL as the browser client because the auth cookie name is derived from it.
 */
export function createClient() {
  const cookieStore = cookies()
  const { url, publishableKey } = requirePublicSupabaseConfig()

  return createServerClient<Database>(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

// The secret-key admin client lives in '@/lib/supabase/admin' (server-only, never
// falls back to the publishable key).
