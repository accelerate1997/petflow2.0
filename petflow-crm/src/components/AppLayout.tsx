'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import SidebarWrapper from '@/components/SidebarWrapper'

function AppLayoutContent({ children, settings }: { children: React.ReactNode; settings: any }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const isLoginPage = pathname === '/login'
  const isOnboardingPage = pathname === '/onboarding'
  const isErrorPage = pathname?.includes('error') || pathname?.includes('_global') || pathname === '/unauthorized'

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role
      if (role === 'SpaAdmin' && !settings?.onboarded && !isOnboardingPage && !isLoginPage && !isErrorPage) {
        window.location.href = '/onboarding'
      }
    }
  }, [session, status, settings, pathname, isOnboardingPage, isLoginPage, isErrorPage])

  if (isLoginPage || isOnboardingPage || isErrorPage) {
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

export default function AppLayout({ children, settings }: { children: React.ReactNode; settings: any }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <main className="w-full h-screen overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {children}
      </main>
    )
  }

  return <AppLayoutContent settings={settings}>{children}</AppLayoutContent>
}
