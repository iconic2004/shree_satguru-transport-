/** Returns an error message, or null if the new password is acceptable. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.'
  }
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

/** Parse a user-entered amount. Returns NaN for blank/invalid input (never silently 0). */
export function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN
  const str = String(value).trim().replace(/,/g, '')
  if (str === '') return NaN
  const n = Number(str)
  return Number.isFinite(n) ? n : NaN
}

/** Today's date (YYYY-MM-DD) in India Standard Time, regardless of the browser's zone. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Add days to a YYYY-MM-DD date string (calendar arithmetic, timezone-safe). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Current wall-clock time (HH:MM:SS) in India Standard Time, for TIME columns. */
export function nowTimeIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
}
