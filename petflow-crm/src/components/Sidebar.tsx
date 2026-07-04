'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PawPrint, Users, Calendar, Settings, Sparkles, Tag, UserCog, ShoppingBag, BarChart2, Megaphone, Receipt, MessageSquare, Bot, BedDouble, LogOut, Truck } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'


// Routes only accessible to SpaAdmin and SuperAdmin — hidden from Staff
const adminOnlyHrefs = ['/staff']

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/crm',          label: 'Pet CRM',      icon: Sparkles },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/boarding',     label: 'Boarding',     icon: BedDouble },
  { href: '/vans',         label: 'Grooming Vans', icon: Truck },
  { href: '/services',     label: 'Services',     icon: Tag },
  { href: '/pets',         label: 'Pets',         icon: PawPrint },
  { href: '/clients',      label: 'Clients',      icon: Users },
  { href: '/staff',        label: 'Staff',        icon: UserCog },
  { href: '/inventory',    label: 'Inventory',    icon: ShoppingBag },
  { href: '/analytics',    label: 'Analytics',    icon: BarChart2 },
  { href: '/billing',      label: 'Billing',      icon: Receipt },
  { href: '/marketing',    label: 'Marketing',    icon: Megaphone },
  { href: '/crm/chats',    label: 'AI Chats',     icon: MessageSquare },
  { href: '/petro',        label: 'Petro AI',     icon: Bot },
  { href: '/settings',     label: 'Settings',     icon: Settings },
]


export default function Sidebar({ settings }: { settings: any }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const boardingEnabled = settings?.boarding_enabled ?? true
  const retailEnabled = settings?.retail_enabled ?? true
  const logoUrl = settings?.logo_url || null
  const spaName = settings?.spa_name || 'PetFlow'

  const role = (user as any)?.role as string | undefined
  const isStaff = role === 'Staff'

  const filteredNavItems = navItems.filter(item => {
    if (item.href === '/boarding' && !boardingEnabled) return false
    if (item.href === '/inventory' && !retailEnabled) return false
    if (item.href === '/vans' && !(settings?.mobile_enabled ?? false)) return false
    if (isStaff && adminOnlyHrefs.includes(item.href)) return false
    return true
  })


  if (!mounted) {
    return (
      <aside
        className="flex flex-col h-screen desktop-only"
        style={{
          width: '240px',
          minWidth: '240px',
          background: 'white',
          borderRight: '1px solid rgba(0,0,0,0.07)',
          padding: '1.5rem 1rem',
        }}
      />
    )
  }

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
          {logoUrl ? (
            <div className="w-[38px] h-[38px] rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 border border-gray-100 flex-shrink-0">
              <img src={logoUrl} alt={spaName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                background: 'var(--sage)',
              }}
            >
              <PawPrint size={20} color="white" />
            </div>
          )}
          <div>
            <p className="font-700 text-gray-900 truncate max-w-[150px]" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
              {spaName}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--sage)', fontWeight: 500 }}>Spa CRM</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b0b8c1', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.5rem', marginBottom: '0.375rem' }}>
            Management
          </p>
          {filteredNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname ? (pathname === href || pathname.startsWith(href + '/')) : false
            const displayLabel = (href === '/settings' && isStaff) ? 'My Account' : label
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                {displayLabel}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        {user ? (
          <div
            className="rounded-xl p-3 mt-4 border border-gray-100 flex flex-col gap-3"
            style={{ backgroundColor: 'var(--sage-muted)', border: '1px solid rgba(137,168,148,0.15)' }}
          >
            <div className="flex items-center gap-2.5">
              <div 
                className="flex items-center justify-center rounded-full bg-white text-sage-dark font-semibold text-xs border border-gray-200"
                style={{ width: '32px', height: '32px', color: 'var(--sage-dark)', flexShrink: 0 }}
              >
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0" style={{ overflow: 'hidden' }}>
                <p className="font-semibold truncate text-gray-800" style={{ fontSize: '0.8rem', margin: 0, fontWeight: 600 }}>
                  {user.name || 'User'}
                </p>
                <p className="truncate text-gray-500 text-xs" style={{ fontSize: '0.7rem', margin: 0 }}>
                  {(user as any).role || 'Staff'}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 w-full text-left text-xs text-red-600 hover:text-red-700 font-medium py-1 px-1 transition-colors cursor-pointer"
              style={{ color: '#dc2626', border: 'none', background: 'none', padding: 0 }}
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
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
        )}
      </aside>

      {/* Mobile Nav Bar */}
      <nav 
        className="mobile-only fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-1 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto hide-scrollbar"
      >
        <div className="flex items-center gap-1 min-w-max">
          {filteredNavItems.map(({ href, icon: Icon }) => {
            const isActive = pathname ? (pathname === href || pathname.startsWith(href + '/')) : false
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${isActive ? 'text-sage-dark bg-sage-muted' : 'text-gray-400'}`}
                style={{
                  color: isActive ? 'var(--sage-dark)' : '#9ca3af',
                  backgroundColor: isActive ? 'var(--sage-muted)' : 'transparent',
                  flexShrink: 0,
                  minWidth: '56px'
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
