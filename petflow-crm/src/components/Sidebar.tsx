'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PawPrint, Users, Calendar, Settings, Sparkles, Tag } from 'lucide-react'

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/crm',          label: 'Pet CRM',      icon: Sparkles },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/services',     label: 'Services',     icon: Tag },
  { href: '/pets',         label: 'Pets',         icon: PawPrint },
  { href: '/clients',      label: 'Clients',      icon: Users },
  { href: '/settings',     label: 'Settings',     icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="flex flex-col h-screen desktop-only"
        style={{
          width: '240px',
          minWidth: '240px',
          background: 'white',
          borderRight: '1px solid rgba(0,0,0,0.07)',
          padding: '1.5rem 1rem',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)',
            }}
          >
            <PawPrint size={20} color="white" />
          </div>
          <div>
            <p className="font-700 text-gray-900" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
              PetFlow
            </p>
            <p style={{ fontSize: '0.7rem', color: '#89A894', fontWeight: 500 }}>Spa CRM</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b0b8c1', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.5rem', marginBottom: '0.375rem' }}>
            Management
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div
          className="rounded-xl p-3 mt-4"
          style={{ background: 'var(--sage-muted)', border: '1px solid rgba(137,168,148,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} style={{ color: 'var(--sage-dark)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sage-dark)' }}>
              PetFlow Pro
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#6b7280' }}>
            Your pet spa management hub
          </p>
        </div>
      </aside>

      {/* Mobile Nav Bar */}
      <nav 
        className="mobile-only fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-1 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      >
        <div className="flex items-center justify-between">
          {navItems.slice(0, 5).map(({ href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${isActive ? 'text-sage-dark bg-sage-muted' : 'text-gray-400'}`}
                style={{
                  color: isActive ? 'var(--sage-dark)' : '#9ca3af',
                  backgroundColor: isActive ? 'var(--sage-muted)' : 'transparent',
                  flex: 1
                }}
              >
                <Icon size={22} />
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
