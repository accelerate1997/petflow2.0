import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'PetFlow CRM — Pet Spa Management',
  description: 'Professional CRM for managing pet spa clients and their beloved pets.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning={true}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

