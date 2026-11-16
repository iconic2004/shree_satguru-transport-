import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type Permission, type UserRole } from '@/lib/constants/roles'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export interface AuthContext {
  user: User
  profile: { id: string; role: UserRole; is_active: boolean; full_name: string | null }
  /** User-scoped client: every query is subject to RLS as this user. */
  supabase: ReturnType<typeof createClient>
}

type AuthResult = { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }

function fail(status: number, error: string): AuthResult {
  return { ok: false, response: NextResponse.json({ success: false, error }, { status }) }
}

/**
 * Authenticate the caller of a route handler and (optionally) require a permission.
 * Returns 401 for no/invalid session, 403 for inactive accounts or missing permission.
 */
export async function requireAuth(permission?: Permission): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return fail(503, 'Service not configured')

  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return fail(401, 'Authentication required')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const typed = profile as AuthContext['profile'] | null
  if (!typed || !typed.is_active) return fail(403, 'Account is inactive')
  if (permission && !hasPermission(typed.role, permission)) {
    return fail(403, 'You do not have permission to perform this action')
  }

  return { ok: true, ctx: { user, profile: typed, supabase } }
}
