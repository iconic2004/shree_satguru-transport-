import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/server'
import { createAdminClient, hasServiceRoleKey } from '@/lib/supabase/admin'
import { getErrorMessage } from '@/lib/utils/errors'

export const dynamic = 'force-dynamic'

const PRIORITIES = ['normal', 'high', 'urgent'] as const

const goodsSchema = z.object({
  invoice_number: z.string().trim().min(1, 'Invoice number is required').max(100),
  challan_number: z.string().trim().max(100).nullish(),
  consignor_name: z.string().trim().min(1, 'Consignor is required').max(200),
  consignee_name: z.string().trim().max(200).nullish(),
  product_name: z.string().trim().min(1, 'Product name is required').max(300),
  product_category: z.string().trim().max(100).nullish(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0').max(1e9),
  unit: z.string().trim().max(50).nullish(),
  weight_kg: z.coerce.number().min(0, 'Weight cannot be negative').max(1e9),
  delivery_city: z.string().trim().min(1, 'Destination city is required').max(100),
  priority: z.enum(PRIORITIES).default('normal'),
  handling_instructions: z.string().trim().max(1000).nullish(),
  warehouse_id: z.string().uuid().nullish(),
})

function withNames(row: any) {
  return {
    ...row,
    consignor_name: row.companies?.name || '-',
    consignee_name: row.customers?.name || '-',
  }
}

export async function GET() {
  const auth = await requireAuth('VIEW_GOODS')
  if (!auth.ok) return auth.response

  // User-scoped client: RLS applies.
  const { data, error } = await (auth.ctx.supabase.from('goods_receipts') as any)
    .select('*, companies(name), customers(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/goods failed:', error.code, error.message)
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: (data || []).map(withNames) })
}

export async function POST(req: Request) {
  const auth = await requireAuth('MANAGE_GOODS')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth.ctx

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = goodsSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input' },
      { status: 400 }
    )
  }
  const input = parsed.data

  try {
    // Consignor companies / consignee customers are auto-created from the goods form.
    // Under RLS only admins may create them, so after the caller has been authorized
    // for MANAGE_GOODS we resolve them with the service role when it is configured.
    const directory = hasServiceRoleKey() ? createAdminClient() : supabase

    // 1. Resolve or create the consignor company (exact, case-insensitive name match)
    let consignorCompanyId: string | null = null
    {
      const { data: existing, error } = await (directory.from('companies') as any)
        .select('id')
        .ilike('name', escapeLike(input.consignor_name))
        .limit(1)
      if (error) throw error
      if (existing?.length) {
        consignorCompanyId = existing[0].id
      } else {
        const { data: created, error: createErr } = await (directory.from('companies') as any)
          .insert([{ name: input.consignor_name, company_type: 'consignor', city: input.delivery_city, is_active: true }])
          .select('id')
        if (createErr) throw createErr
        consignorCompanyId = created?.[0]?.id ?? null
      }
    }
    if (!consignorCompanyId) {
      return NextResponse.json({ success: false, error: 'Could not resolve consignor company' }, { status: 400 })
    }

    // 2. Resolve or create the consignee customer (optional)
    let consigneeCustomerId: string | null = null
    if (input.consignee_name) {
      const { data: existing, error } = await (directory.from('customers') as any)
        .select('id')
        .ilike('name', escapeLike(input.consignee_name))
        .limit(1)
      if (error) throw error
      if (existing?.length) {
        consigneeCustomerId = existing[0].id
      } else {
        const { data: created, error: createErr } = await (directory.from('customers') as any)
          .insert([{ name: input.consignee_name, company_id: consignorCompanyId, city: input.delivery_city, is_active: true }])
          .select('id')
        if (createErr) throw createErr
        consigneeCustomerId = created?.[0]?.id ?? null
      }
    }

    // 3. Resolve warehouse (default: first active warehouse)
    let warehouseId = input.warehouse_id ?? null
    if (!warehouseId) {
      const { data: wh, error } = await (supabase.from('warehouses') as any)
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
      if (error) throw error
      warehouseId = wh?.[0]?.id ?? null
    }

    // 4. Insert the goods receipt AS THE USER (RLS enforced)
    const { data, error } = await (supabase.from('goods_receipts') as any)
      .insert([{
        invoice_number: input.invoice_number,
        challan_number: input.challan_number || null,
        consignor_company_id: consignorCompanyId,
        consignee_customer_id: consigneeCustomerId,
        product_name: input.product_name,
        product_category: input.product_category || 'General Cargo',
        quantity: input.quantity,
        unit: input.unit || 'cartons',
        weight_kg: input.weight_kg,
        delivery_city: input.delivery_city,
        priority: input.priority,
        handling_instructions: input.handling_instructions || null,
        status: 'verification_pending',
        warehouse_id: warehouseId,
        created_by: user.id,
      }])
      .select('*, companies(name), customers(name)')

    if (error) {
      const status = error.code === '23505' ? 409 : error.code === '42501' ? 403 : 400
      const message = error.code === '23505'
        ? `Invoice ${input.invoice_number} is already registered for this consignor.`
        : getErrorMessage(error)
      return NextResponse.json({ success: false, error: message }, { status })
    }
    if (!data?.[0]) {
      return NextResponse.json({ success: false, error: 'Goods receipt was not saved' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: withNames(data[0]) }, { status: 201 })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    console.error('POST /api/goods failed:', e?.code, e?.message)
    const status = e?.code === '42501' ? 403 : 500
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status })
  }
}

/** Escape LIKE wildcards so names are matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`)
}
