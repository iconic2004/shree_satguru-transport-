/** Round to 2 decimal places (paise) using half-away-from-zero. */
export function roundMoney(value: number): number {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100
}

export interface InvoiceTotals {
  subtotal: number
  tax_rate: number
  tax_amount: number
  tds_amount: number
  total_amount: number
}

/**
 * Invoice totals as used by the billing module:
 *  - GST is charged on the subtotal at `taxRate` %.
 *  - TDS (`tdsRate` % of the subtotal) is recorded for reference; it is deducted by
 *    the customer at payment time, so it does NOT reduce the invoice total.
 */
export function computeInvoiceTotals(subtotal: number, taxRate: number, tdsRate = 2): InvoiceTotals {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error('Subtotal must be 0 or more')
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Tax rate must be between 0 and 100')
  if (!Number.isFinite(tdsRate) || tdsRate < 0 || tdsRate > 100) throw new Error('TDS rate must be between 0 and 100')

  const sub = roundMoney(subtotal)
  const tax = roundMoney((sub * taxRate) / 100)
  const tds = roundMoney((sub * tdsRate) / 100)
  return {
    subtotal: sub,
    tax_rate: taxRate,
    tax_amount: tax,
    tds_amount: tds,
    total_amount: roundMoney(sub + tax),
  }
}

/** Sum a numeric field across rows, tolerating numeric strings / nulls from the API. */
export function sumBy<T>(rows: T[], pick: (row: T) => unknown): number {
  return roundMoney(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0))
}

/** Dispatch load as % of vehicle capacity, rounded to 2 dp. Returns null when capacity is unknown. */
export function capacityUtilization(cargoKg: number, capacityKg: number | null | undefined): number | null {
  if (!capacityKg || capacityKg <= 0 || !Number.isFinite(cargoKg)) return null
  return roundMoney((cargoKg / capacityKg) * 100)
}
