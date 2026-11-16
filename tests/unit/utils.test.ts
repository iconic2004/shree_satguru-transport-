import { describe, it, expect } from 'vitest'
import { computeInvoiceTotals, capacityUtilization, roundMoney, sumBy } from '@/lib/utils/finance'
import { addDays, nowTimeIST, parseAmount, todayIST, validateNewPassword } from '@/lib/utils/validation'
import { escapeCsvCell, toCsv } from '@/lib/utils/csv'
import { getErrorMessage } from '@/lib/utils/errors'
import { receivablesBucket } from '@/lib/reports'

describe('computeInvoiceTotals', () => {
  it('applies the selected GST rate (regression: was always 18%)', () => {
    expect(computeInvoiceTotals(10000, 5)).toEqual({
      subtotal: 10000, tax_rate: 5, tax_amount: 500, tds_amount: 200, total_amount: 10500,
    })
    expect(computeInvoiceTotals(10000, 18).total_amount).toBe(11800)
    expect(computeInvoiceTotals(10000, 0).total_amount).toBe(10000)
  })

  it('does not subtract TDS from the invoice total', () => {
    const t = computeInvoiceTotals(60000, 18)
    expect(t.total_amount).toBe(70800)
    expect(t.tds_amount).toBe(1200)
  })

  it('rounds to paise', () => {
    expect(computeInvoiceTotals(333.33, 18).tax_amount).toBe(60)
    expect(computeInvoiceTotals(1234.565, 12).subtotal).toBe(1234.57)
  })

  it('rejects invalid input', () => {
    expect(() => computeInvoiceTotals(-1, 18)).toThrow()
    expect(() => computeInvoiceTotals(100, 101)).toThrow()
    expect(() => computeInvoiceTotals(Number.NaN, 18)).toThrow()
  })
})

describe('capacityUtilization', () => {
  it('uses the real vehicle capacity (regression: was hard-coded 9500 kg)', () => {
    expect(capacityUtilization(850, 1700)).toBe(50)
    expect(capacityUtilization(9500, 9500)).toBe(100)
    expect(capacityUtilization(2000, 1200)).toBeGreaterThan(100)
  })
  it('returns null when capacity is unknown', () => {
    expect(capacityUtilization(100, 0)).toBeNull()
    expect(capacityUtilization(100, null)).toBeNull()
  })
})

describe('money helpers', () => {
  it('sumBy tolerates numeric strings and nulls', () => {
    expect(sumBy([{ a: '10.10' }, { a: 5 }, { a: null }], r => r.a)).toBe(15.1)
  })
  it('roundMoney avoids float drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1.005)).toBe(1.01)
  })
})

describe('parseAmount', () => {
  it('returns NaN for blank / invalid input instead of silently using 0', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('  ')).toBeNaN()
    expect(parseAmount('abc')).toBeNaN()
    expect(parseAmount(null)).toBeNaN()
  })
  it('parses numbers with Indian grouping commas', () => {
    expect(parseAmount('1,00,000')).toBe(100000)
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount(0)).toBe(0)
  })
})

describe('validateNewPassword', () => {
  it('enforces length, letters+digits and confirmation', () => {
    expect(validateNewPassword('short1', 'short1')).toMatch(/8 characters/)
    expect(validateNewPassword('longpassword', 'longpassword')).toMatch(/letter and one number/)
    expect(validateNewPassword('password123', 'password124')).toMatch(/do not match/)
    expect(validateNewPassword('password123', 'password123')).toBeNull()
  })
})

describe('IST date helpers', () => {
  it('todayIST uses India time, not UTC (22:00 UTC = next day in IST)', () => {
    expect(todayIST(new Date('2026-11-16T22:00:00Z'))).toBe('2026-11-17')
    expect(todayIST(new Date('2026-11-16T10:00:00Z'))).toBe('2026-11-16')
  })
  it('nowTimeIST returns HH:MM:SS in IST', () => {
    expect(nowTimeIST(new Date('2026-11-16T00:00:00Z'))).toBe('05:30:00')
  })
  it('addDays handles month/year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-11-16', 30)).toBe('2026-12-16')
  })
})

describe('CSV export', () => {
  it('quotes and escapes embedded quotes / commas / newlines', () => {
    expect(escapeCsvCell('Frooti "200ml", cartons')).toBe('"Frooti ""200ml"", cartons"')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })
  it('neutralises spreadsheet formula injection in text', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(escapeCsvCell('+cmd')).toBe('"\'+cmd"')
    expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
  })
  it('leaves real numbers (including negatives) intact', () => {
    expect(escapeCsvCell(-1500)).toBe('-1500')
    expect(escapeCsvCell(12.5)).toBe('12.5')
    expect(escapeCsvCell(null)).toBe('')
  })
  it('does not truncate on # (regression: encodeURI data URL cut the file)', () => {
    const csv = toCsv(['Invoice'], [['INV#42'], ['INV#43']])
    expect(csv).toContain('INV#42')
    expect(csv).toContain('INV#43')
  })
})

describe('getErrorMessage', () => {
  it('maps Postgres / PostgREST codes to user-friendly text', () => {
    expect(getErrorMessage({ code: '23505', message: 'duplicate key' })).toMatch(/already exists/)
    expect(getErrorMessage({ code: '42501', message: 'denied' })).toMatch(/permission/)
    expect(getErrorMessage({ message: 'new row violates row-level security policy for table "x"' })).toMatch(/permission/)
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Unable to reach/)
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})

describe('receivablesBucket', () => {
  it('buckets by days overdue', () => {
    expect(receivablesBucket(null)).toBe('Not due')
    expect(receivablesBucket(0)).toBe('Not due')
    expect(receivablesBucket(15)).toBe('1-30 days')
    expect(receivablesBucket(45)).toBe('31-60 days')
    expect(receivablesBucket(75)).toBe('61-90 days')
    expect(receivablesBucket(120)).toBe('90+ days')
  })
})
