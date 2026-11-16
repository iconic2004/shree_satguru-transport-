export type CsvValue = string | number | boolean | null | undefined

/**
 * Escape one CSV cell:
 *  - wraps in quotes and doubles embedded quotes (RFC 4180)
 *  - neutralises spreadsheet formula injection (=, +, -, @, tab, CR at start)
 *    for text values; real numbers are left untouched.
 */
export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  return `"${str.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: CsvValue[][], preamble: string[] = []): string {
  const lines = [
    ...preamble.map(line => escapeCsvCell(line)),
    ...(preamble.length ? [''] : []),
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ]
  return lines.join('\r\n')
}

/** Trigger a browser download of CSV text (UTF-8 with BOM so Excel shows ₹ correctly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
