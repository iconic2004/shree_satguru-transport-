'use client'

import { Sidebar } from './sidebar'
import { Header } from './header'
import { ToastProvider } from '@/components/shared/toast-provider'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50 dark:bg-gray-900 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50/60 dark:bg-gray-950">
          {children}
        </main>
      </div>
      <ToastProvider />
    </div>
  )
}
