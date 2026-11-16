'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { UserProvider } from '@/lib/hooks/use-user'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()

  // Close the mobile drawer after navigating.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <UserProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50/50 dark:bg-gray-900 font-sans">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 bg-slate-50/60 dark:bg-gray-950">
            {children}
          </main>
        </div>
      </div>
    </UserProvider>
  )
}
