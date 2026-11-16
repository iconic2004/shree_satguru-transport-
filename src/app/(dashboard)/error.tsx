'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard route error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-4">
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-navy-950">Something went wrong on this page</h2>
        <p className="text-sm text-gray-500 max-w-md">
          The page could not be displayed. Your data has not been changed. Try again, or go back to the dashboard.
        </p>
        {error.digest && <p className="text-[11px] text-gray-400">Reference: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} className="bg-navy-900 hover:bg-navy-950 text-white">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
          Go to dashboard
        </Button>
      </div>
    </div>
  )
}
