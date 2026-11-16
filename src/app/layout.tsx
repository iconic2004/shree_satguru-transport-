import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/shared/toast-provider'

export const metadata: Metadata = {
  title: 'Shree Satguru Transport — Management System',
  description: 'Enterprise Transport Management System (TMS) for Shree Satguru Transport',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
