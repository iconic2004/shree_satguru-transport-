'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@/lib/hooks/use-user'
import { hasPermission, type Permission } from '@/lib/constants/roles'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Truck,
  Users,
  UserCog,
  ClipboardList,
  MapPin,
  Receipt,
  CreditCard,
  DollarSign,
  BarChart3,
  Bell,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserCheck,
  Loader2,
  CalendarDays,
  Wallet,
  FileText,
  ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  permission?: Permission
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Goods & Invoices',
    href: '/goods',
    icon: Package,
    permission: 'VIEW_GOODS',
  },
  {
    label: 'Warehouse',
    href: '/warehouse',
    icon: Warehouse,
    permission: 'VIEW_GOODS',
    children: [
      { label: 'Receipts', href: '/warehouse', icon: ClipboardList },
      { label: 'Inventory', href: '/warehouse#inventory', icon: Package },
      { label: 'Movements', href: '/warehouse#movements', icon: ArrowUpDown },
    ],
  },
  {
    label: 'Loading / Unloading',
    href: '/loading-unloading',
    icon: Loader2,
    permission: 'VIEW_LOADING',
  },
  {
    label: 'Companies',
    href: '/companies',
    icon: Building2,
    permission: 'VIEW_COMPANIES',
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'VIEW_CUSTOMERS',
  },
  {
    label: 'Drivers',
    href: '/drivers',
    icon: UserCheck,
    permission: 'VIEW_DRIVERS',
  },
  {
    label: 'Vehicles',
    href: '/vehicles',
    icon: Truck,
    permission: 'VIEW_VEHICLES',
  },
  {
    label: 'Staff & Labour',
    href: '/staff',
    icon: UserCog,
    permission: 'VIEW_STAFF',
    children: [
      { label: 'All Staff', href: '/staff', icon: Users },
      { label: 'Attendance', href: '/staff/attendance', icon: CalendarDays },
      { label: 'Advances', href: '/staff/advances', icon: Wallet },
      { label: 'Payroll & Settlements', href: '/staff/payroll', icon: DollarSign },
    ],
  },
  {
    label: 'Dispatch Planning',
    href: '/dispatch',
    icon: MapPin,
    permission: 'VIEW_DISPATCH',
  },
  {
    label: 'Deliveries & POD',
    href: '/deliveries',
    icon: ClipboardList,
    permission: 'VIEW_DELIVERY',
  },
  {
    label: 'Customer Billing',
    href: '/billing',
    icon: Receipt,
    permission: 'VIEW_BILLING',
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    permission: 'VIEW_PAYMENTS',
  },
  {
    label: 'Expenses',
    href: '/expenses',
    icon: DollarSign,
    permission: 'VIEW_EXPENSES',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'VIEW_REPORTS',
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'MANAGE_SETTINGS',
  },
  {
    label: 'Admin',
    href: '/admin/users',
    icon: ShieldCheck,
    permission: 'VIEW_USERS',
    children: [
      { label: 'User Roles', href: '/admin/users', icon: Users },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList },
    ],
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Warehouse', 'Staff & Labour'])
  const pathname = usePathname()
  const { profile } = useUser()

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    )
  }

  const filteredNav = navigation.filter(item => {
    if (!item.permission) return true
    if (!profile?.role) return true // Show all in local development/fallback
    return hasPermission(profile.role, item.permission)
  })

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r bg-navy-950 text-white transition-all duration-300 z-30 select-none',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-navy-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white shadow-md">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">
                  Shree Satguru
                </span>
                <span className="text-[11px] text-orange-400 font-semibold tracking-wider uppercase">
                  Transport TMS
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center mx-auto shadow-md">
              <Truck className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedGroups.includes(item.label)
            const Icon = item.icon

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center w-full h-10 rounded-md transition-colors',
                        isActive
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <div key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={cn(
                        'flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-navy-800 text-white font-medium'
                          : 'text-gray-300 hover:bg-navy-800/60 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 text-gray-400" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 transition-transform text-gray-400',
                          isExpanded && 'rotate-90 text-white'
                        )}
                      />
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-navy-800 pl-3">
                        {item.children!.map((child) => {
                          const childActive = pathname === child.href
                          const ChildIcon = child.icon
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                                childActive
                                  ? 'bg-orange-500 text-white font-medium'
                                  : 'text-gray-400 hover:bg-navy-800 hover:text-white'
                              )}
                            >
                              <ChildIcon className="w-3.5 h-3.5" />
                              <span>{child.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-orange-500 text-white font-semibold shadow-sm'
                        : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* Collapse Toggle Footer */}
        <div className="border-t border-navy-800 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-gray-300 hover:bg-navy-800 hover:text-white justify-center"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
