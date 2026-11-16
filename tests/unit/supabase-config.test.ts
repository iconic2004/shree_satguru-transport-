import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createClientSpy = vi.fn((url: string, key: string, _opts?: unknown) => ({ url, key }))
vi.mock('@supabase/supabase-js', () => ({ createClient: (url: string, key: string, opts?: unknown) => createClientSpy(url, key, opts) }))

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
  requirePublicSupabaseConfig,
} from '@/lib/supabase/config'
import { createAdminClient, hasServiceRoleKey } from '@/lib/supabase/admin'
import { checkSupabaseEnv } from '../../next.config.mjs'

const NAMES = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
]
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const n of NAMES) { saved[n] = process.env[n]; delete process.env[n] }
  createClientSpy.mockClear()
})
afterEach(() => {
  for (const n of NAMES) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n] }
  vi.unstubAllGlobals()
})

describe('public config (browser / middleware / session clients)', () => {
  it('uses the new publishable key name', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_new'
    expect(requirePublicSupabaseConfig()).toEqual({ url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_new' })
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('falls back to the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY during migration', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon'
    expect(getSupabasePublishableKey()).toBe('legacy-anon')
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('prefers the new name when both are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_new'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon'
    expect(getSupabasePublishableKey()).toBe('sb_publishable_new')
  })

  it('never uses the server-only SUPABASE_URL or secret key for session clients', () => {
    process.env.SUPABASE_URL = 'https://server-only.example.com'
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_x'
    expect(getSupabaseUrl()).toBeUndefined()
    expect(getSupabasePublishableKey()).toBeUndefined()
    expect(isSupabaseConfigured()).toBe(false)
    expect(() => requirePublicSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('treats example placeholders as not configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_real'
    expect(isSupabaseConfigured()).toBe(false)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'your-publishable-key'
    expect(isSupabaseConfigured()).toBe(false)
  })
})

describe('admin client (server-only secret key)', () => {
  it('uses SUPABASE_SECRET_KEY and the server SUPABASE_URL when set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co'
    process.env.SUPABASE_URL = 'https://server.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_new'
    createAdminClient()
    expect(createClientSpy).toHaveBeenCalledWith('https://server.supabase.co', 'sb_secret_new', expect.anything())
  })

  it('falls back to NEXT_PUBLIC_SUPABASE_URL and the legacy SUPABASE_SERVICE_ROLE_KEY', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service'
    expect(hasServiceRoleKey()).toBe(true)
    createAdminClient()
    expect(createClientSpy).toHaveBeenCalledWith('https://public.supabase.co', 'legacy-service', expect.anything())
  })

  it('never falls back to the publishable key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_new'
    expect(hasServiceRoleKey()).toBe(false)
    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/)
    expect(createClientSpy).not.toHaveBeenCalled()
  })

  it('refuses to run in a browser environment', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co'
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_new'
    vi.stubGlobal('window', {})
    expect(() => createAdminClient()).toThrow(/server-only/)
    expect(() => hasServiceRoleKey()).toThrow(/server-only/)
  })
})

describe('build-time env guard (next.config.mjs)', () => {
  const ok = { NEXT_PUBLIC_SUPABASE_URL: 'https://a.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SUPABASE_SECRET_KEY: 'sb_secret_y' }
  const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`

  it('accepts a correct configuration', () => {
    expect(() => checkSupabaseEnv(ok)).not.toThrow()
  })

  it('fails when a secret uses the NEXT_PUBLIC_ prefix', () => {
    expect(() => checkSupabaseEnv({ ...ok, NEXT_PUBLIC_SUPABASE_SECRET_KEY: 'sb_secret_y' })).toThrow(/NEXT_PUBLIC_SUPABASE_SECRET_KEY/)
    expect(() => checkSupabaseEnv({ ...ok, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x' })).toThrow(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('fails when a secret key is placed in the publishable slot (new or legacy format)', () => {
    expect(() => checkSupabaseEnv({ ...ok, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_y' })).toThrow(/contains a SECRET key/)
    expect(() => checkSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') })).toThrow(/contains a SECRET key/)
  })

  it('fails when a publishable key is placed in the secret slot', () => {
    expect(() => checkSupabaseEnv({ ...ok, SUPABASE_SECRET_KEY: 'sb_publishable_x' })).toThrow(/contains a publishable key/)
  })

  it('never includes key values in its error messages', () => {
    try {
      checkSupabaseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_VERY-SENSITIVE-VALUE' })
    } catch (e) {
      expect((e as Error).message).not.toContain('VERY-SENSITIVE-VALUE')
      return
    }
    throw new Error('expected guard to throw')
  })

  it('warns (does not fail) when only legacy names are used', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => checkSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy', SUPABASE_SERVICE_ROLE_KEY: 'legacy2' })).not.toThrow()
    expect(warn.mock.calls[0][0]).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY \(rename to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\)/)
    expect(warn.mock.calls[0][0]).not.toContain('legacy2')
    warn.mockRestore()
  })
})
