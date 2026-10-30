import { cn } from '@/lib/utils/cn'
import { type LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  className?: string
  iconClassName?: string
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: KPICardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-950 rounded-xl border border-gray-200/80 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-1">
              <span
                className={cn(
                  'text-xs font-semibold',
                  trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-[11px] text-gray-500 font-normal">
                {trend.label}
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'p-2.5 rounded-xl flex-shrink-0',
            iconClassName || 'bg-navy-50 text-navy-800 dark:bg-navy-950 dark:text-navy-300'
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
