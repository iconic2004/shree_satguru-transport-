import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/lib/constants/roles'
import {
  canAccessRoute,
  isAuthenticatedPublicRoute,
  isPublicRoute,
} from '@/lib/auth/route-access'
import { isSupabaseConfigured, requirePublicSupabaseConfig } from '@/lib/supabase/config'

/** Copy refreshed auth cookies from the pass-through response onto a redirect. */
function redirectWithCookies(source: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
  return redirect
}

function loginUrl(request: NextRequest, error?: string): URL {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  const target = request.nextUrl.pathname + request.nextUrl.search
  if (target !== '/' && !error) url.searchParams.set('redirectTo', target)
  if (error) url.searchParams.set('error', error)
  return url
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api/')
  const isPublic = isPublicRoute(pathname)

  let supabaseResponse = NextResponse.next({ request })

  // Static files from /public (robots.txt, manifest.json, …) and /.well-known
  // never need a session. App routes never contain a dot.
  if (pathname.startsWith('/.well-known/') || (!isApi && /\/[^/]+\.[a-z0-9]+$/i.test(pathname))) {
    return supabaseResponse
  }

  // Fail CLOSED when Supabase is not configured: never serve protected pages.
  if (!isSupabaseConfigured()) {
    if (isPublic) return supabaseResponse
    if (isApi) {
      return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 503 })
    }
    return NextResponse.redirect(loginUrl(request, 'config'))
  }

  try {
    const { url, publishableKey } = requirePublicSupabaseConfig()
    const supabase = createServerClient(
      url,
      publishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options as any)
            )
          },
        },
      }
    )

    // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // API route handlers perform their own authentication/authorization.
    if (isApi) return supabaseResponse

    if (!user) {
      if (isPublic) return supabaseResponse
      return redirectWithCookies(supabaseResponse, loginUrl(request))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    const typedProfile = profile as { role: UserRole; is_active: boolean } | null

    if (!typedProfile || !typedProfile.is_active) {
      await supabase.auth.signOut()
      return redirectWithCookies(supabaseResponse, loginUrl(request, 'inactive'))
    }

    if (isPublic) {
      if (isAuthenticatedPublicRoute(pathname)) return supabaseResponse
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return redirectWithCookies(supabaseResponse, url)
    }

    if (!canAccessRoute(typedProfile.role, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      url.searchParams.set('denied', pathname)
      return redirectWithCookies(supabaseResponse, url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware auth check failed:', error instanceof Error ? error.message : error)
    // Fail CLOSED on unexpected errors.
    if (isPublic) return supabaseResponse
    if (isApi) {
      return NextResponse.json({ success: false, error: 'Authentication service unavailable' }, { status: 503 })
    }
    return NextResponse.redirect(loginUrl(request, 'unavailable'))
  }
}
