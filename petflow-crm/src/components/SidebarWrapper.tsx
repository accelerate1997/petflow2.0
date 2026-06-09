'use client'

import nextDynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const Sidebar = nextDynamic(() => import('./Sidebar'), { ssr: false })

export default function SidebarWrapper({ settings }: { settings: any }) {
  const pathname = usePathname()
  
  if (pathname === '/login') {
    return null
  }

  return <Sidebar settings={settings} />
}

