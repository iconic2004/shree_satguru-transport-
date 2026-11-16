import { describe, it, expect } from 'vitest'
import {
  canAccessRoute,
  getRequiredPermission,
  isAuthenticatedPublicRoute,
  isPublicRoute,
  safeRedirectPath,
} from '@/lib/auth/route-access'
import { hasPermission, type UserRole } from '@/lib/constants/roles'

describe('getRequiredPermission', () => {
  it('uses the most specific prefix', () => {
    expect(getRequiredPermission('/staff')).toBe('VIEW_STAFF')
    expect(getRequiredPermission('/staff/payroll')).toBe('VIEW_PAYROLL')
    expect(getRequiredPermission('/staff/attendance')).toBe('VIEW_ATTENDANCE')
    expect(getRequiredPermission('/admin/audit-logs')).toBe('VIEW_AUDIT_LOGS')
    expect(getRequiredPermission('/admin/users')).toBe('VIEW_USERS')
  })

  it('does not match on partial segment names', () => {
    // "/goodsXYZ" must not inherit /goods rules, and must not crash
    expect(getRequiredPermission('/goodsXYZ')).toBeNull()
    expect(getRequiredPermission('/staffing')).toBeNull()
  })

  it('leaves common pages open to any signed-in user', () => {
    expect(getRequiredPermission('/dashboard')).toBeNull()
    expect(getRequiredPermission('/notifications')).toBeNull()
    expect(getRequiredPermission('/settings')).toBeNull()
  })
})

describe('canAccessRoute — role matrix for the four primary roles', () => {
  const matrix: Array<[UserRole, string, boolean]> = [
    // Super Admin: everything
    ['super_admin', '/billing', true],
    ['super_admin', '/admin/users', true],
    ['super_admin', '/staff/payroll', true],
    // Operations Manager
    ['operations_manager', '/dispatch', true],
    ['operations_manager', '/goods', true],
    ['operations_manager', '/billing', false],
    ['operations_manager', '/payments', false],
    ['operations_manager', '/staff/payroll', false],
    ['operations_manager', '/admin/users', false],
    // Accountant
    ['accountant', '/billing', true],
    ['accountant', '/payments', true],
    ['accountant', '/expenses', true],
    ['accountant', '/staff/payroll', true],
    ['accountant', '/dispatch', false],
    ['accountant', '/vehicles', false],
    ['accountant', '/admin/audit-logs', false],
    // Warehouse Staff
    ['warehouse_staff', '/goods', true],
    ['warehouse_staff', '/warehouse', true],
    ['warehouse_staff', '/loading-unloading', true],
    ['warehouse_staff', '/dispatch', true], // view only (VIEW_DISPATCH)
    ['warehouse_staff', '/billing', false],
    ['warehouse_staff', '/payments', false],
    ['warehouse_staff', '/drivers', false],
    ['warehouse_staff', '/staff', false],
    ['warehouse_staff', '/reports', false],
    ['warehouse_staff', '/admin/users', false],
  ]

  it.each(matrix)('%s → %s = %s', (role, path, expected) => {
    expect(canAccessRoute(role, path)).toBe(expected)
  })

  it('denies restricted routes when the role is unknown', () => {
    expect(canAccessRoute(null, '/billing')).toBe(false)
    expect(canAccessRoute(undefined, '/admin/users')).toBe(false)
    expect(canAccessRoute(null, '/dashboard')).toBe(true)
  })

  it('only super admins may manage users', () => {
    expect(hasPermission('super_admin', 'MANAGE_USERS')).toBe(true)
    expect(hasPermission('admin', 'MANAGE_USERS')).toBe(false)
    expect(hasPermission('operations_manager', 'MANAGE_USERS')).toBe(false)
  })
})

describe('public routes', () => {
  it('recognises auth pages', () => {
    expect(isPublicRoute('/login')).toBe(true)
    expect(isPublicRoute('/forgot-password')).toBe(true)
    expect(isPublicRoute('/reset-password')).toBe(true)
    expect(isPublicRoute('/auth/callback')).toBe(true)
    expect(isPublicRoute('/dashboard')).toBe(false)
    expect(isPublicRoute('/login-admin')).toBe(false)
  })

  it('lets signed-in users stay on recovery pages', () => {
    expect(isAuthenticatedPublicRoute('/reset-password')).toBe(true)
    expect(isAuthenticatedPublicRoute('/login')).toBe(false)
  })
})

describe('safeRedirectPath (open-redirect protection)', () => {
  it('accepts same-origin paths', () => {
    expect(safeRedirectPath('/billing')).toBe('/billing')
    expect(safeRedirectPath('/goods?tab=1')).toBe('/goods?tab=1')
  })

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    'javascript:alert(1)',
    '',
    null,
    undefined,
    '/login',
    '/forgot-password',
    '/billing\r\nSet-Cookie: x=1',
  ])('rejects %j', (target) => {
    expect(safeRedirectPath(target as string | null | undefined)).toBe('/dashboard')
  })
})
