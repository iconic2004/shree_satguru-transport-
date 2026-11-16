import { roundMoney } from '@/lib/utils/finance'
import { addDays } from '@/lib/utils/validation'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** YYYY-MM-DD of a timestamp in IST. */
export function istDate(ts: string | null | undefined): string | null {
  if (!ts) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export interface DeliveryPoint { status: string; updated_at: string | null }

/** Last 7 days (oldest first) of delivery outcomes, bucketed by the day the delivery was last updated. */
export function weeklyDeliveryPerformance(deliveries: DeliveryPoint[], today: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const rows = days.map(date => {
    const [y, m, d] = date.split('-').map(Number)
    return { date, day: DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], delivered: 0, failed: 0, scheduled: 0 }
  })
  const byDate = new Map(rows.map(r => [r.date, r]))
  for (const del of deliveries) {
    const row = byDate.get(istDate(del.updated_at) ?? '')
    if (!row) continue
    if (del.status === 'delivered') row.delivered++
    else if (del.status === 'failed' || del.status === 'rescheduled') row.failed++
    if (del.status === 'delivered' || del.status === 'failed' || del.status === 'rescheduled') row.scheduled++
  }
  return rows
}

/** Success rate of completed attempts, or null when there were none. */
export function successRate(rows: Array<{ delivered: number; failed: number }>): number | null {
  const delivered = rows.reduce((s, r) => s + r.delivered, 0)
  const attempts = delivered + rows.reduce((s, r) => s + r.failed, 0)
  return attempts === 0 ? null : Math.round((delivered / attempts) * 1000) / 10
}

/** Revenue (excl. GST) vs expenses for the last `months` calendar months, oldest first. */
export function monthlyProfitability(
  invoices: Array<{ invoice_date: string | null; subtotal: unknown; status: string }>,
  expenses: Array<{ expense_date: string | null; amount: unknown }>,
  today: string,
  months = 6
) {
  const [ty, tm] = today.split('-').map(Number)
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (months - 1 - i), 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
  const map = new Map(keys.map(k => [k, { income: 0, expenses: 0 }]))
  invoices.forEach(inv => {
    if (inv.status === 'cancelled' || inv.status === 'credited' || !inv.invoice_date) return
    const bucket = map.get(inv.invoice_date.slice(0, 7))
    if (bucket) bucket.income += Number(inv.subtotal) || 0
  })
  expenses.forEach(exp => {
    const bucket = exp.expense_date ? map.get(exp.expense_date.slice(0, 7)) : undefined
    if (bucket) bucket.expenses += Number(exp.amount) || 0
  })
  return keys.map(k => {
    const v = map.get(k)!
    return {
      month: MONTH_LABELS[Number(k.slice(5, 7)) - 1],
      income: roundMoney(v.income),
      expenses: roundMoney(v.expenses),
      profit: roundMoney(v.income - v.expenses),
    }
  })
}

export interface ExpiringDoc { entity: string; type: string; expiry: string; days: number; severity: 'expired' | 'warning' | 'info' }

/** Documents expiring within `windowDays` (or already expired), soonest first. */
export function expiringDocuments(
  vehicles: Array<{ registration_number: string; insurance_expiry: string | null; fitness_expiry: string | null; permit_expiry: string | null; puc_expiry: string | null }>,
  drivers: Array<{ full_name: string; licence_expiry: string | null }>,
  today: string,
  windowDays = 30
): ExpiringDoc[] {
  const docs: ExpiringDoc[] = []
  const consider = (entity: string, type: string, expiry: string | null) => {
    if (!expiry) return
    const days = Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000)
    if (Number.isNaN(days) || days > windowDays) return
    docs.push({ entity, type, expiry, days, severity: days < 0 ? 'expired' : days <= 7 ? 'warning' : 'info' })
  }
  vehicles.forEach(v => {
    consider(v.registration_number, 'Insurance', v.insurance_expiry)
    consider(v.registration_number, 'Fitness Certificate', v.fitness_expiry)
    consider(v.registration_number, 'Permit', v.permit_expiry)
    consider(v.registration_number, 'PUC Certificate', v.puc_expiry)
  })
  drivers.forEach(d => consider(d.full_name, 'Driving Licence', d.licence_expiry))
  return docs.sort((a, b) => a.days - b.days)
}
