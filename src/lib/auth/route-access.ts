import { hasPermission, type Permission, type UserRole } from '@/lib/constants/roles'

/** Routes reachable without a session. */
export const PUBLIC_ROUTES = ['/login', '/forgot-password', '/auth/callback', '/reset-password'] as const

/**
 * Routes a signed-in user may still open (they must not be bounced to /dashboard).
 * /reset-password needs the recovery session; /auth/callback creates it.
 */
export const AUTHENTICATED_PUBLIC_ROUTES = ['/auth/callback', '/reset-password'] as const

/**
 * Required permission per route prefix. The most specific (longest) prefix wins.
 * Routes not listed here (e.g. /dashboard, /notifications, /settings) are open to
 * every active, signed-in user. Keep this in sync with the sidebar.
 */
export const ROUTE_PERMISSIONS: ReadonlyArray<readonly [string, Permission]> = [
  ['/goods', 'VIEW_GOODS'],
  ['/warehouse', 'VIEW_GOODS'],
  ['/loading-unloading', 'VIEW_LOADING'],
  ['/companies', 'VIEW_COMPANIES'],
  ['/customers', 'VIEW_CUSTOMERS'],
  ['/drivers', 'VIEW_DRIVERS'],
  ['/vehicles', 'VIEW_VEHICLES'],
  ['/staff/attendance', 'VIEW_ATTENDANCE'],
  ['/staff/advances', 'VIEW_ADVANCES'],
  ['/staff/payroll', 'VIEW_PAYROLL'],
  ['/staff', 'VIEW_STAFF'],
  ['/dispatch', 'VIEW_DISPATCH'],
  ['/deliveries', 'VIEW_DELIVERY'],
  ['/billing', 'VIEW_BILLING'],
  ['/payments', 'VIEW_PAYMENTS'],
  ['/expenses', 'VIEW_EXPENSES'],
  ['/reports', 'VIEW_REPORTS'],
  ['/admin/audit-logs', 'VIEW_AUDIT_LOGS'],
  ['/admin', 'VIEW_USERS'],
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(r => matchesPrefix(pathname, r))
}

export function isAuthenticatedPublicRoute(pathname: string): boolean {
  return AUTHENTICATED_PUBLIC_ROUTES.some(r => matchesPrefix(pathname, r))
}

/** Permission required for a page path, or null if any signed-in user may open it. */
export function getRequiredPermission(pathname: string): Permission | null {
  let best: readonly [string, Permission] | null = null
  for (const entry of ROUTE_PERMISSIONS) {
    if (matchesPrefix(pathname, entry[0]) && (!best || entry[0].length > best[0].length)) {
      best = entry
    }
  }
  return best ? best[1] : null
}

export function canAccessRoute(role: UserRole | null | undefined, pathname: string): boolean {
  const permission = getRequiredPermission(pathname)
  if (!permission) return true
  if (!role) return false
  return hasPermission(role, permission)
}

/**
 * Sanitise a post-login redirect target to prevent open redirects.
 * Only same-origin absolute paths are allowed; auth pages are not valid targets.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/dashboard'): string {
  if (!target || typeof target !== 'string') return fallback
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback
  if (/[\r\n\t]/.test(target)) return fallback
  const pathOnly = target.split(/[?#]/)[0]
  if (isPublicRoute(pathOnly) && !isAuthenticatedPublicRoute(pathOnly)) return fallback
  return target
}
