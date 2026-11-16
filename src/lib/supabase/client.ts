'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/types/database'
import { requirePublicSupabaseConfig } from '@/lib/supabase/config'

/** Browser client: publishable key only, all queries subject to RLS. */
export function createClient() {
  const { url, publishableKey } = requirePublicSupabaseConfig()
  return createBrowserClient<Database>(url, publishableKey)
}
