import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/types/database'

/*
 * SERVER-ONLY. This module reads the Supabase secret key and must never be imported
 * from a 'use client' component. It is only used by route handlers in src/app/api/.
 *
 * Variable names (new API key format):
 *   SUPABASE_SECRET_KEY  sb_secret_… key (bypasses RLS)
 *   SUPABASE_URL         optional server-side project URL; defaults to NEXT_PUBLIC_SUPABASE_URL
 *
 * Transitional fallback: SUPABASE_SERVICE_ROLE_KEY (legacy name) is still read when
 * SUPABASE_SECRET_KEY is not set. Remove it once every environment is migrated.
 */

function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error('The Supabase admin client is server-only and must not be used in the browser.')
  }
}

function getSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined
}

/** URL for the admin client (no cookies/sessions, so it may differ from the public URL). */
function getServerUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || undefined
}

/** True when a secret key is available on the server. */
export function hasServiceRoleKey(): boolean {
  assertServer()
  return Boolean(getSecretKey())
}

/**
 * Admin client using the secret key. BYPASSES RLS — only use after the caller has
 * been authenticated and authorized server-side. Never falls back to the publishable key.
 */
export function createAdminClient() {
  assertServer()
  const supabaseUrl = getServerUrl()
  const secretKey = getSecretKey()
  if (!supabaseUrl || !secretKey) {
    throw new Error('SUPABASE_SECRET_KEY (and a Supabase URL) must be configured on the server')
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
