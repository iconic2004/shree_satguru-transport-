import { cn } from '@/lib/utils/cn'

interface StatusBadgeProps {
  status: string
  labels?: Record<string, string>
  colors?: Record<string, string>
  className?: string
}

export function StatusBadge({ status, labels = {}, colors = {}, className }: StatusBadgeProps) {
  const label = labels[status] || status.replace(/_/g, ' ')
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
