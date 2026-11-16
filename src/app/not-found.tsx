import Link from 'next/link'
import { Truck } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center gap-4 p-4 bg-slate-50">
      <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg">
        <Truck className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-navy-950">Page not found</h1>
      <p className="text-sm text-gray-500 max-w-sm">The page you are looking for does not exist or has been moved.</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-950"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
