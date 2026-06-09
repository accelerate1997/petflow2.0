'use client'

import { usePathname } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'

export default function AppLayout({ children, settings }: { children: React.ReactNode; settings: any }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return (
      <main className="w-full h-screen overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarWrapper settings={settings} />
      <main className="flex-1 overflow-y-auto pt-6 md:pt-10 px-4 md:px-8 pb-12" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
