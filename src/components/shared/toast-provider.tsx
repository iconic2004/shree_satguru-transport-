'use client'

import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

export function ToastProvider() {
  const { toasts, dismiss } = useToast()

  const icons = {
    default: Info,
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
  }

  const styles = {
    default: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100',
    success: 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-900 text-gray-900 dark:text-gray-100',
    error: 'bg-white dark:bg-gray-900 border-rose-200 dark:border-rose-900 text-gray-900 dark:text-gray-100',
    warning: 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-900 text-gray-900 dark:text-gray-100',
  }

  const iconStyles = {
    default: 'text-blue-500',
    success: 'text-emerald-500',
    error: 'text-rose-500',
    warning: 'text-amber-500',
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const variant = toast.variant || 'default'
        const Icon = icons[variant]
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl transition-all duration-300 animate-in slide-in-from-right',
              styles[variant]
            )}
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', iconStyles[variant])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
