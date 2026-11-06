import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase.from('goods_receipts') as any)
      .select('*, companies(name), customers(name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goods:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const formatted = (data || []).map((row: any) => ({
      ...row,
      consignor_name: row.companies?.name || 'Direct Consignor',
      consignee_name: row.customers?.name || 'Direct Customer',
    }))

    return NextResponse.json({ success: true, data: formatted })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    let consignorCompanyId = body.consignor_company_id

    // 1. Auto-create or resolve consignor company if consignor_name provided
    if (body.consignor_name && body.consignor_name.trim()) {
      const trimmedName = body.consignor_name.trim()
      const { data: existingComp } = await (supabase.from('companies') as any)
        .select('id')
        .ilike('name', trimmedName)
        .limit(1)

      if (existingComp && existingComp.length > 0) {
        consignorCompanyId = existingComp[0].id
      } else {
        const { data: newComp } = await (supabase.from('companies') as any)
          .insert([{
            name: trimmedName,
            company_type: 'consignor',
            city: body.delivery_city || 'Mumbai',
            is_active: true,
          }])
          .select('id')

        if (newComp && newComp[0]) {
          consignorCompanyId = newComp[0].id
        }
      }
    }

    // Fallback if still missing: use any existing company or create one
    if (!consignorCompanyId) {
      const { data: anyComp } = await supabase.from('companies').select('id').limit(1)
      if (anyComp && anyComp.length > 0) {
        consignorCompanyId = (anyComp as any)[0].id
      } else {
        const { data: createdComp } = await (supabase.from('companies') as any)
          .insert([{
            name: 'General Cargo Consignor',
            company_type: 'consignor',
            city: 'Mumbai',
            is_active: true,
          }])
          .select('id')
        consignorCompanyId = (createdComp as any)?.[0]?.id
      }
    }

    let consigneeCustomerId = body.consignee_customer_id

    // 2. Auto-create or resolve consignee customer if consignee_name provided
    if (body.consignee_name && body.consignee_name.trim()) {
      const trimmedCust = body.consignee_name.trim()
      const { data: existingCust } = await (supabase.from('customers') as any)
        .select('id')
        .ilike('name', trimmedCust)
        .limit(1)

      if (existingCust && existingCust.length > 0) {
        consigneeCustomerId = existingCust[0].id
      } else {
        const { data: newCust } = await (supabase.from('customers') as any)
          .insert([{
            name: trimmedCust,
            company_id: consignorCompanyId,
            city: body.delivery_city || 'Mumbai',
            is_active: true,
          }])
          .select('id')
        if (newCust && newCust[0]) {
          consigneeCustomerId = newCust[0].id
        }
      }
    }

    // 3. Resolve warehouse
    let warehouseId = body.warehouse_id
    if (!warehouseId) {
      const { data: wh } = await supabase.from('warehouses').select('id').limit(1)
      warehouseId = (wh as any)?.[0]?.id || null
    }

    const newRecord: any = {
      invoice_number: body.invoice_number.trim(),
      challan_number: body.challan_number?.trim() || null,
      consignor_company_id: consignorCompanyId,
      consignee_customer_id: consigneeCustomerId || null,
      product_name: body.product_name.trim(),
      product_category: body.product_category || 'General Cargo',
      quantity: parseFloat(body.quantity) || 1,
      unit: body.unit || 'cartons',
      weight_kg: parseFloat(body.weight_kg) || 0,
      delivery_city: body.delivery_city?.trim() || 'Mumbai',
      priority: body.priority || 'normal',
      handling_instructions: body.handling_instructions || null,
      status: body.status || 'verification_pending',
      warehouse_id: warehouseId,
    }

    const { data, error } = await (supabase.from('goods_receipts') as any)
      .insert([newRecord])
      .select('*, companies(name), customers(name)')

    if (error) {
      console.error('Insert goods receipt error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    const savedItem = {
      ...data[0],
      consignor_name: body.consignor_name || data[0]?.companies?.name || 'Direct Consignor',
      consignee_name: body.consignee_name || data[0]?.customers?.name || 'Direct Customer',
    }

    return NextResponse.json({ success: true, data: savedItem })
  } catch (err: any) {
    console.error('API /api/goods POST error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
