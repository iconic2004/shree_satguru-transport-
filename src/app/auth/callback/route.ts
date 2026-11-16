import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/auth/route-access'

export const dynamic = 'force-dynamic'

/**
 * Completes Supabase email links (password recovery, invites, magic links).
 * Supports both the PKCE `?code=` flow and the `?token_hash=&type=` flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get('next'))

  const supabase = createClient()

  let failed = true
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    failed = Boolean(error)
  }

  if (failed) {
    return NextResponse.redirect(new URL('/login?error=link', origin))
  }

  // Recovery links always land on the set-new-password page.
  const destination = type === 'recovery' ? '/reset-password' : next
  return NextResponse.redirect(new URL(destination, origin))
}
