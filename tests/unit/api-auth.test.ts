import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression tests: /api/goods used the service-role key with NO authentication.
const state: {
  user: { id: string } | null
  profile: { id: string; role: string; is_active: boolean; full_name: string } | null
  goodsQueried: boolean
} = { user: null, profile: null, goodsQueried: false }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.user ? null : { message: 'no session' } }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }) }) }
      }
      state.goodsQueried = true
      return { select: () => ({ order: async () => ({ data: [], error: null }) }) }
    },
  }),
}))

// The service-role client must never be reached by unauthorised callers.
const adminFactory = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminFactory(),
  hasServiceRoleKey: () => true,
}))

import { GET, POST } from '@/app/api/goods/route'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://unit-test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-anon-key'
  state.user = null
  state.profile = null
  state.goodsQueried = false
  adminFactory.mockReset()
})

const validBody = {
  invoice_number: 'INV-1',
  consignor_name: 'Acme',
  product_name: 'Cartons',
  quantity: 10,
  weight_kg: 100,
  delivery_city: 'Pune',
}

const post = (body: unknown) =>
  POST(new Request('https://tms.example.com/api/goods', { method: 'POST', body: JSON.stringify(body) }))

describe('/api/goods authorization', () => {
  it('GET rejects anonymous callers with 401 and never touches data', async () => {
    const res = await GET()
    expect(res.status).toBe(401)
    expect(state.goodsQueried).toBe(false)
  })

  it('POST rejects anonymous callers with 401 and never uses the service role', async () => {
    const res = await post(validBody)
    expect(res.status).toBe(401)
    expect(adminFactory).not.toHaveBeenCalled()
  })

  it('rejects deactivated accounts with 403', async () => {
    state.user = { id: 'u1' }
    state.profile = { id: 'u1', role: 'super_admin', is_active: false, full_name: 'X' }
    expect((await GET()).status).toBe(403)
  })

  it('POST rejects roles without MANAGE_GOODS (accountant) with 403', async () => {
    state.user = { id: 'u2' }
    state.profile = { id: 'u2', role: 'accountant', is_active: true, full_name: 'Acc' }
    const res = await post(validBody)
    expect(res.status).toBe(403)
    expect(adminFactory).not.toHaveBeenCalled()
  })

  it('GET allows roles with VIEW_GOODS and queries as the user (RLS)', async () => {
    state.user = { id: 'u3' }
    state.profile = { id: 'u3', role: 'warehouse_staff', is_active: true, full_name: 'WH' }
    const res = await GET()
    expect(res.status).toBe(200)
    expect(state.goodsQueried).toBe(true)
    expect(adminFactory).not.toHaveBeenCalled()
  })

  it('POST validates input before any database work', async () => {
    state.user = { id: 'u3' }
    state.profile = { id: 'u3', role: 'warehouse_staff', is_active: true, full_name: 'WH' }
    const res = await post({ ...validBody, quantity: -5 })
    expect(res.status).toBe(400)
    expect(adminFactory).not.toHaveBeenCalled()
  })
})
