import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shree Satguru Transport — Management System',
  description: 'Enterprise Transport Management System (TMS) for Shree Satguru Transport',
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
      </body>
    </html>
  )
}
