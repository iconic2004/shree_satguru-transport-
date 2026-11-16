import { describe, it, expect } from 'vitest'
import {
  expiringDocuments,
  istDate,
  monthlyProfitability,
  successRate,
  weeklyDeliveryPerformance,
} from '@/lib/dashboard-metrics'

describe('istDate', () => {
  it('converts timestamps to the IST calendar date', () => {
    expect(istDate('2026-11-16T20:00:00Z')).toBe('2026-11-17')
    expect(istDate('2026-11-16')).toBe('2026-11-16')
    expect(istDate(null)).toBeNull()
    expect(istDate('not a date')).toBeNull()
  })
})

describe('weeklyDeliveryPerformance', () => {
  it('builds 7 days ending today from real delivery rows', () => {
    const rows = weeklyDeliveryPerformance(
      [
        { status: 'delivered', updated_at: '2026-11-16T05:00:00Z' },
        { status: 'delivered', updated_at: '2026-11-16T06:00:00Z' },
        { status: 'failed', updated_at: '2026-11-15T06:00:00Z' },
        { status: 'in_transit', updated_at: '2026-11-16T06:00:00Z' }, // not an outcome
        { status: 'delivered', updated_at: '2026-10-01T06:00:00Z' }, // outside window
      ],
      '2026-11-16'
    )
    expect(rows).toHaveLength(7)
    expect(rows[6]).toMatchObject({ date: '2026-11-16', day: 'Mon', delivered: 2, failed: 0, scheduled: 2 })
    expect(rows[5]).toMatchObject({ date: '2026-11-15', delivered: 0, failed: 1 })
    expect(successRate(rows)).toBe(66.7)
  })

  it('reports no success rate when nothing was attempted (regression: hard-coded 96.4%)', () => {
    expect(successRate(weeklyDeliveryPerformance([], '2026-11-16'))).toBeNull()
  })
})

describe('monthlyProfitability', () => {
  it('uses revenue excluding GST, skips cancelled invoices, and covers 6 months', () => {
    const data = monthlyProfitability(
      [
        { invoice_date: '2026-11-03', subtotal: 100000, status: 'issued' },
        { invoice_date: '2026-11-10', subtotal: 50000, status: 'cancelled' },
        { invoice_date: '2026-10-20', subtotal: '20000', status: 'paid' },
      ],
      [
        { expense_date: '2026-11-05', amount: 30000 },
        { expense_date: '2026-04-05', amount: 999 }, // older than the window
      ],
      '2026-11-16'
    )
    expect(data.map(d => d.month)).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'])
    expect(data[5]).toEqual({ month: 'Nov', income: 100000, expenses: 30000, profit: 70000 })
    expect(data[4]).toEqual({ month: 'Oct', income: 20000, expenses: 0, profit: 20000 })
  })
})

describe('expiringDocuments', () => {
  it('lists expired and soon-to-expire documents, soonest first', () => {
    const docs = expiringDocuments(
      [{ registration_number: 'MH-01', insurance_expiry: '2026-11-20', fitness_expiry: '2027-06-01', permit_expiry: null, puc_expiry: '2026-11-10' }],
      [{ full_name: 'Ramesh', licence_expiry: '2026-12-10' }, { full_name: 'Suresh', licence_expiry: '2028-01-01' }],
      '2026-11-16'
    )
    expect(docs.map(d => [d.entity, d.type, d.days, d.severity])).toEqual([
      ['MH-01', 'PUC Certificate', -6, 'expired'],
      ['MH-01', 'Insurance', 4, 'warning'],
      ['Ramesh', 'Driving Licence', 24, 'info'],
    ])
  })
})
