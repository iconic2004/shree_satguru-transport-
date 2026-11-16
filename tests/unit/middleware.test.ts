import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocked Supabase server client: each test sets the user / profile it returns.
const state: {
  user: { id: string } | null
  profile: { role: string; is_active: boolean } | null
  throwOnGetUser: boolean
  signedOut: boolean
} = { user: null, profile: null, throwOnGetUser: false, signedOut: false }

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => {
        if (state.throwOnGetUser) throw new Error('network down')
        return { data: { user: state.user }, error: null }
      },
      signOut: async () => {
        state.signedOut = true
        return { error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.profile, error: null }),
        }),
      }),
    }),
  }),
}))

import { updateSession } from '@/lib/supabase/middleware'

const ORIGINAL_ENV = { ...process.env }
const req = (path: string) => new NextRequest(new URL(path, 'https://tms.example.com'))

function location(res: Response): URL | null {
  const loc = res.headers.get('location')
  return loc ? new URL(loc) : null
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-anon-key'
  state.user = null
  state.profile = null
  state.throwOnGetUser = false
  state.signedOut = false
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('middleware: unauthenticated access', () => {
  it('redirects protected pages to /login with redirectTo', async () => {
    const res = await updateSession(req('/billing?month=10'))
    const loc = location(res)
    expect(res.status).toBe(307)
    expect(loc?.pathname).toBe('/login')
    expect(loc?.searchParams.get('redirectTo')).toBe('/billing?month=10')
  })

  it('serves public auth pages', async () => {
    for (const path of ['/login', '/forgot-password', '/reset-password', '/auth/callback']) {
      const res = await updateSession(req(path))
      expect(location(res), path).toBeNull()
    }
  })

  it('serves static files and /.well-known without a session', async () => {
    for (const path of ['/robots.txt', '/manifest.json', '/.well-known/security.txt']) {
      expect(location(await updateSession(req(path))), path).toBeNull()
    }
  })

  it('does not treat dotted query strings as static files', async () => {
    const res = await updateSession(req('/billing?file=a.csv'))
    expect(location(res)?.pathname).toBe('/login')
  })

  it('passes API routes through (route handlers authenticate themselves)', async () => {
    const res = await updateSession(req('/api/goods'))
    expect(location(res)).toBeNull()
  })
})

describe('middleware: fails closed', () => {
  it('blocks protected pages when Supabase env is missing (regression: used to pass through)', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const res = await updateSession(req('/dashboard'))
    expect(location(res)?.pathname).toBe('/login')
    expect(location(res)?.searchParams.get('error')).toBe('config')
  })

  it('blocks protected pages with placeholder credentials', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co'
    const res = await updateSession(req('/goods'))
    expect(location(res)?.pathname).toBe('/login')
  })

  it('returns 503 for API routes when not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const res = await updateSession(req('/api/goods'))
    expect(res.status).toBe(503)
  })

  it('blocks protected pages when the auth check throws (regression: used to pass through)', async () => {
    state.throwOnGetUser = true
    const res = await updateSession(req('/billing'))
    expect(location(res)?.pathname).toBe('/login')
    expect(location(res)?.searchParams.get('error')).toBe('unavailable')
  })
})

describe('middleware: authenticated access', () => {
  it('signs out and blocks deactivated users', async () => {
    state.user = { id: 'u1' }
    state.profile = { role: 'super_admin', is_active: false }
    const res = await updateSession(req('/dashboard'))
    expect(location(res)?.searchParams.get('error')).toBe('inactive')
    expect(state.signedOut).toBe(true)
  })

  it('blocks users with no profile row', async () => {
    state.user = { id: 'u1' }
    state.profile = null
    const res = await updateSession(req('/dashboard'))
    expect(location(res)?.searchParams.get('error')).toBe('inactive')
  })

  it('redirects a role away from pages it may not open', async () => {
    state.user = { id: 'u1' }
    state.profile = { role: 'warehouse_staff', is_active: true }
    const res = await updateSession(req('/billing'))
    const loc = location(res)
    expect(loc?.pathname).toBe('/dashboard')
    expect(loc?.searchParams.get('denied')).toBe('/billing')
  })

  it('allows a role onto pages it may open', async () => {
    state.user = { id: 'u1' }
    state.profile = { role: 'accountant', is_active: true }
    const res = await updateSession(req('/billing'))
    expect(location(res)).toBeNull()
  })

  it('sends signed-in users from /login to /dashboard but keeps them on /reset-password', async () => {
    state.user = { id: 'u1' }
    state.profile = { role: 'operations_manager', is_active: true }
    expect(location(await updateSession(req('/login')))?.pathname).toBe('/dashboard')
    expect(location(await updateSession(req('/reset-password')))).toBeNull()
  })
})
