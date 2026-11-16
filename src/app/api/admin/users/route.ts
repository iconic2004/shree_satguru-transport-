import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/server'
import { createAdminClient, hasServiceRoleKey } from '@/lib/supabase/admin'
import { ROLES } from '@/lib/constants/roles'
import { getErrorMessage } from '@/lib/utils/errors'

export const dynamic = 'force-dynamic'

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]]

const createSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional().default(''),
  role: z.enum(ROLE_VALUES),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

const updateSchema = z
  .object({
    id: z.string().uuid(),
    role: z.enum(ROLE_VALUES).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(v => v.role !== undefined || v.is_active !== undefined, 'Nothing to update')

function serviceUnavailable() {
  return NextResponse.json(
    { success: false, error: 'User management requires SUPABASE_SECRET_KEY to be configured on the server.' },
    { status: 503 }
  )
}

/** List users (profiles + login email). Admins and Super Admins. */
export async function GET() {
  const auth = await requireAuth('VIEW_USERS')
  if (!auth.ok) return auth.response

  // RLS lets admins read all profiles.
  const { data: profiles, error } = await (auth.ctx.supabase.from('profiles') as any)
    .select('id, full_name, phone, role, is_active, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })

  const emails = new Map<string, string>()
  if (hasServiceRoleKey()) {
    const admin = createAdminClient()
    for (let page = 1; page <= 20; page++) {
      const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (listError) break
      data.users.forEach(u => emails.set(u.id, u.email ?? ''))
      if (data.users.length < 200) break
    }
  }

  return NextResponse.json({
    success: true,
    data: (profiles || []).map((p: any) => ({ ...p, email: emails.get(p.id) ?? '' })),
  })
}

/** Create a login + profile with the given role. Super Admin only. */
export async function POST(req: Request) {
  const auth = await requireAuth('MANAGE_USERS')
  if (!auth.ok) return auth.response
  if (!hasServiceRoleKey()) return serviceUnavailable()

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data
  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, phone: input.phone || null },
  })
  if (createError || !created.user) {
    const msg = /already.*registered|already exists/i.test(createError?.message ?? '')
      ? 'A user with this email already exists.'
      : getErrorMessage(createError, 'Could not create user')
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }

  // The handle_new_user trigger creates the profile with the least-privileged role;
  // the role chosen by the Super Admin is applied here, server-side.
  const { data: profile, error: profileError } = await (admin.from('profiles') as any)
    .upsert(
      { id: created.user.id, full_name: input.full_name, phone: input.phone || null, role: input.role, is_active: true },
      { onConflict: 'id' }
    )
    .select('id, full_name, phone, role, is_active, created_at')
    .single()

  if (profileError) {
    // Roll back the auth user so we never leave a login without a correct profile.
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ success: false, error: getErrorMessage(profileError) }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { ...profile, email: input.email } }, { status: 201 })
}

/** Change a user's role and/or active status. Super Admin only. */
export async function PATCH(req: Request) {
  const auth = await requireAuth('MANAGE_USERS')
  if (!auth.ok) return auth.response

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { id, role, is_active } = parsed.data

  if (id === auth.ctx.user.id && (is_active === false || (role !== undefined && role !== 'super_admin'))) {
    return NextResponse.json(
      { success: false, error: 'You cannot deactivate or demote your own account.' },
      { status: 400 }
    )
  }

  const changes: Record<string, unknown> = {}
  if (role !== undefined) changes.role = role
  if (is_active !== undefined) changes.is_active = is_active

  // RLS: only active super admins may update profiles.
  const { data, error } = await (auth.ctx.supabase.from('profiles') as any)
    .update(changes)
    .eq('id', id)
    .select('id, full_name, phone, role, is_active, created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 400 })
  if (!data) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  // Revoke active sessions immediately when deactivating.
  if (is_active === false && hasServiceRoleKey()) {
    await createAdminClient().auth.admin.signOut(id).catch(() => undefined)
  }

  return NextResponse.json({ success: true, data })
}
