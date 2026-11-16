import type { SupabaseClient } from '@supabase/supabase-js'
import type { CsvValue } from '@/lib/utils/csv'
import { roundMoney } from '@/lib/utils/finance'
import { todayIST } from '@/lib/utils/validation'

export type ReportKey =
  | 'goods_inward'
  | 'stock_aging'
  | 'discrepancy'
  | 'dispatch_register'
  | 'delivery_pod'
  | 'fuel_toll'
  | 'muster_roll'
  | 'advances'
  | 'payroll'
  | 'profit_loss'
  | 'receivables_aging'
  | 'vehicle_profitability'

export interface ReportTable {
  headers: string[]
  rows: CsvValue[][]
}

type Client = SupabaseClient<any, any, any>

const IN_GODOWN = ['received', 'verification_pending', 'available', 'reserved', 'partially_dispatched', 'damaged', 'on_hold']

function daysBetween(fromIso: string | null | undefined, toIso: string = todayIST()): number | null {
  if (!fromIso) return null
  const from = Date.parse(fromIso.slice(0, 10))
  const to = Date.parse(toIso)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.floor((to - from) / 86400000)
}

async function run<T = any>(query: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** First day of the current IST month, YYYY-MM-DD. */
function monthStart(): string {
  return `${todayIST().slice(0, 7)}-01`
}

export function receivablesBucket(daysOverdue: number | null): string {
  if (daysOverdue === null || daysOverdue <= 0) return 'Not due'
  if (daysOverdue <= 30) return '1-30 days'
  if (daysOverdue <= 60) return '31-60 days'
  if (daysOverdue <= 90) return '61-90 days'
  return '90+ days'
}

export async function buildReport(supabase: Client, key: ReportKey): Promise<ReportTable> {
  switch (key) {
    case 'goods_inward': {
      const rows = await run(supabase.from('goods_receipts')
        .select('invoice_number, challan_number, invoice_date, product_name, quantity, unit, weight_kg, delivery_city, priority, status, created_at, companies(name), customers(name)')
        .order('created_at', { ascending: false }))
      return {
        headers: ['Invoice No', 'Challan No', 'Invoice Date', 'Consignor', 'Consignee', 'Product', 'Quantity', 'Unit', 'Weight (kg)', 'Destination', 'Priority', 'Status', 'Received On'],
        rows: rows.map((r: any) => [r.invoice_number, r.challan_number, r.invoice_date, r.companies?.name, r.customers?.name, r.product_name, Number(r.quantity), r.unit, Number(r.weight_kg), r.delivery_city, r.priority, r.status, r.created_at?.slice(0, 10)]),
      }
    }
    case 'stock_aging': {
      const rows = await run(supabase.from('goods_receipts')
        .select('invoice_number, product_name, quantity, unit, weight_kg, declared_value, status, received_at, created_at, warehouses(name)')
        .in('status', IN_GODOWN)
        .order('created_at', { ascending: true }))
      return {
        headers: ['Invoice No', 'Product', 'Quantity', 'Unit', 'Weight (kg)', 'Declared Value (INR)', 'Warehouse', 'Status', 'Received On', 'Age (days)'],
        rows: rows.map((r: any) => {
          const received = r.received_at || r.created_at
          return [r.invoice_number, r.product_name, Number(r.quantity), r.unit, Number(r.weight_kg), r.declared_value != null ? Number(r.declared_value) : null, r.warehouses?.name, r.status, received?.slice(0, 10), daysBetween(received)]
        }),
      }
    }
    case 'discrepancy': {
      const rows = await run(supabase.from('goods_items')
        .select('product_name, quantity, accepted_quantity, damaged_quantity, missing_quantity, excess_quantity, rejected_quantity, notes, goods_receipts(invoice_number)')
        .or('damaged_quantity.gt.0,missing_quantity.gt.0,excess_quantity.gt.0,rejected_quantity.gt.0'))
      return {
        headers: ['Invoice No', 'Product', 'Expected', 'Accepted', 'Damaged', 'Missing', 'Excess', 'Rejected', 'Notes'],
        rows: rows.map((r: any) => [r.goods_receipts?.invoice_number, r.product_name, Number(r.quantity), Number(r.accepted_quantity), Number(r.damaged_quantity), Number(r.missing_quantity), Number(r.excess_quantity), Number(r.rejected_quantity), r.notes]),
      }
    }
    case 'dispatch_register': {
      const rows = await run(supabase.from('dispatches')
        .select('dispatch_number, dispatch_date, status, planned_distance_km, actual_distance_km, cargo_weight_kg, capacity_utilization_pct, planned_cost, actual_cost, vehicles(registration_number), drivers(full_name)')
        .order('dispatch_date', { ascending: false }))
      return {
        headers: ['Dispatch No', 'Date', 'Vehicle', 'Driver', 'Status', 'Planned km', 'Actual km', 'Cargo (kg)', 'Utilisation %', 'Planned Cost (INR)', 'Actual Cost (INR)'],
        rows: rows.map((r: any) => [r.dispatch_number, r.dispatch_date, r.vehicles?.registration_number, r.drivers?.full_name, r.status, Number(r.planned_distance_km), Number(r.actual_distance_km), Number(r.cargo_weight_kg), Number(r.capacity_utilization_pct), Number(r.planned_cost), Number(r.actual_cost)]),
      }
    }
    case 'delivery_pod': {
      const rows = await run(supabase.from('deliveries')
        .select('status, destination_city, receiver_name, actual_arrival, failure_reason, customers(name), dispatches(dispatch_number), proof_of_delivery(receiver_name, receiver_phone, captured_at)')
        .order('created_at', { ascending: false }))
      return {
        headers: ['Dispatch No', 'Customer', 'Destination', 'Status', 'Delivered At', 'Receiver', 'Receiver Phone', 'POD Captured', 'Failure Reason'],
        rows: rows.map((r: any) => {
          const pod = (r.proof_of_delivery || [])[0]
          return [r.dispatches?.dispatch_number, r.customers?.name, r.destination_city, r.status, r.actual_arrival, pod?.receiver_name || r.receiver_name, pod?.receiver_phone, pod ? 'Yes' : 'No', r.failure_reason]
        }),
      }
    }
    case 'fuel_toll': {
      const rows = await run(supabase.from('expenses')
        .select('expense_date, category, amount, payment_method, vendor, description, vehicles(registration_number)')
        .in('category', ['diesel_fuel', 'toll'])
        .order('expense_date', { ascending: false }))
      return {
        headers: ['Date', 'Vehicle', 'Category', 'Amount (INR)', 'Payment Mode', 'Vendor', 'Description'],
        rows: rows.map((r: any) => [r.expense_date, r.vehicles?.registration_number, r.category, Number(r.amount), r.payment_method, r.vendor, r.description]),
      }
    }
    case 'muster_roll': {
      const from = monthStart()
      const [staff, drivers] = await Promise.all([
        run(supabase.from('staff_attendance').select('attendance_date, status, remarks, staff_members(full_name, staff_type)').gte('attendance_date', from).order('attendance_date')),
        run(supabase.from('driver_attendance').select('attendance_date, status, remarks, drivers(full_name)').gte('attendance_date', from).order('attendance_date')),
      ])
      return {
        headers: ['Date', 'Name', 'Role', 'Status', 'Remarks'],
        rows: [
          ...drivers.map((r: any) => [r.attendance_date, r.drivers?.full_name, 'driver', r.status, r.remarks] as CsvValue[]),
          ...staff.map((r: any) => [r.attendance_date, r.staff_members?.full_name, r.staff_members?.staff_type, r.status, r.remarks] as CsvValue[]),
        ].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))),
      }
    }
    case 'advances': {
      const rows = await run(supabase.from('staff_advances')
        .select('advance_date, staff_type, amount, applied_amount, remaining_amount, payment_method, reason, status, drivers(full_name), staff_members(full_name)')
        .order('advance_date', { ascending: false }))
      return {
        headers: ['Date', 'Name', 'Role', 'Amount (INR)', 'Applied (INR)', 'Remaining (INR)', 'Payment Mode', 'Reason', 'Status'],
        rows: rows.map((r: any) => [r.advance_date, r.drivers?.full_name || r.staff_members?.full_name, r.staff_type, Number(r.amount), Number(r.applied_amount), r.remaining_amount != null ? Number(r.remaining_amount) : null, r.payment_method, r.reason, r.status]),
      }
    }
    case 'payroll': {
      const rows = await run(supabase.from('payroll_entries')
        .select('staff_type, gross_earnings, total_advances_applied, total_deductions, net_payable, amount_paid, outstanding_amount, payment_status, payroll_periods(period_name), drivers(full_name), staff_members(full_name)')
        .order('created_at', { ascending: false }))
      return {
        headers: ['Period', 'Name', 'Role', 'Gross (INR)', 'Advances (INR)', 'Deductions (INR)', 'Net Payable (INR)', 'Paid (INR)', 'Outstanding (INR)', 'Status'],
        rows: rows.map((r: any) => [r.payroll_periods?.period_name, r.drivers?.full_name || r.staff_members?.full_name, r.staff_type, Number(r.gross_earnings), Number(r.total_advances_applied), Number(r.total_deductions), Number(r.net_payable), Number(r.amount_paid), Number(r.outstanding_amount), r.payment_status]),
      }
    }
    case 'profit_loss': {
      const [invoices, expenses] = await Promise.all([
        run(supabase.from('invoices').select('invoice_date, subtotal, status')),
        run(supabase.from('expenses').select('expense_date, amount')),
      ])
      const months = new Map<string, { revenue: number; expenses: number }>()
      const bucket = (m: string) => months.get(m) ?? months.set(m, { revenue: 0, expenses: 0 }).get(m)!
      invoices
        .filter((i: any) => i.status !== 'cancelled' && i.status !== 'credited' && i.invoice_date)
        // Revenue is measured excluding GST (GST is a liability, not income).
        .forEach((i: any) => { bucket(i.invoice_date.slice(0, 7)).revenue += Number(i.subtotal) || 0 })
      expenses
        .filter((e: any) => e.expense_date)
        .forEach((e: any) => { bucket(e.expense_date.slice(0, 7)).expenses += Number(e.amount) || 0 })
      return {
        headers: ['Month', 'Freight Revenue excl. GST (INR)', 'Operating Expenses (INR)', 'Operating Profit (INR)'],
        rows: Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => [m, roundMoney(v.revenue), roundMoney(v.expenses), roundMoney(v.revenue - v.expenses)]),
      }
    }
    case 'receivables_aging': {
      const rows = await run(supabase.from('invoices')
        .select('invoice_number, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, status, customers(name)')
        .gt('outstanding_amount', 0)
        .not('status', 'in', '(cancelled,credited)')
        .order('due_date', { ascending: true }))
      return {
        headers: ['Invoice No', 'Customer', 'Invoice Date', 'Due Date', 'Total (INR)', 'Paid (INR)', 'Outstanding (INR)', 'Days Overdue', 'Aging Bucket'],
        rows: rows.map((r: any) => {
          const overdue = daysBetween(r.due_date)
          return [r.invoice_number, r.customers?.name, r.invoice_date, r.due_date, Number(r.total_amount), Number(r.paid_amount), Number(r.outstanding_amount), overdue !== null && overdue > 0 ? overdue : 0, receivablesBucket(overdue)]
        }),
      }
    }
    case 'vehicle_profitability': {
      const [vehicles, items, expenses] = await Promise.all([
        run(supabase.from('vehicles').select('id, registration_number')),
        run(supabase.from('invoice_items').select('amount, dispatches(vehicle_id), invoices(status)').not('dispatch_id', 'is', null)),
        run(supabase.from('expenses').select('vehicle_id, amount').not('vehicle_id', 'is', null)),
      ])
      const revenue = new Map<string, number>()
      items
        .filter((i: any) => i.dispatches?.vehicle_id && !['cancelled', 'credited'].includes(i.invoices?.status))
        .forEach((i: any) => revenue.set(i.dispatches.vehicle_id, (revenue.get(i.dispatches.vehicle_id) || 0) + (Number(i.amount) || 0)))
      const cost = new Map<string, number>()
      expenses.forEach((e: any) => cost.set(e.vehicle_id, (cost.get(e.vehicle_id) || 0) + (Number(e.amount) || 0)))
      return {
        headers: ['Vehicle', 'Billed Revenue linked to trips (INR)', 'Vehicle Expenses (INR)', 'Net (INR)'],
        rows: vehicles.map((v: any) => {
          const rev = roundMoney(revenue.get(v.id) || 0)
          const exp = roundMoney(cost.get(v.id) || 0)
          return [v.registration_number, rev, exp, roundMoney(rev - exp)]
        }),
      }
    }
  }
}
