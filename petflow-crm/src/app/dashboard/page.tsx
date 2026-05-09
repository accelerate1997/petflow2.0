import { PawPrint, IndianRupee, Users, TrendingUp, Calendar, ArrowRight, Clock } from 'lucide-react'
import StatCard from '@/components/StatCard'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = new Date()

  // Fetch all required data
  const [petCount, allClients, todayAppointments] = await Promise.all([
    prisma.pet.count(),
    prisma.client.findMany({
      select: { id: true, total_spend: true, join_date: true, name: true, created: true },
      orderBy: { created: 'desc' }
    }),
    prisma.appointment.findMany({
      where: { appointment_date: today },
      include: { pet: true },
      orderBy: { appointment_time: 'asc' }
    })
  ])

  // Calculate stats
  const totalRevenue = allClients.reduce((sum, c) => sum + (c.total_spend || 0), 0)
  const newThisMonth = allClients.filter(c => {
    const d = c.join_date || c.created
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear()
  }).length

  const recentClients = allClients.slice(0, 5)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Good morning! 🌿</h1>
          <p className="text-gray-400 text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8">
        <StatCard
          label="Today's Appts"
          value={todayAppointments.length}
          icon={Calendar}
          iconColor="#3b82f6"
          iconBg="rgba(59, 130, 246, 0.12)"
          trend={`${todayAppointments.length} scheduled`}
          trendPositive
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={IndianRupee}
          iconColor="#8b5cf6"
          iconBg="rgba(139,92,246,0.1)"
          trend="All time"
          trendPositive
        />
        <StatCard
          label="Pet Parents"
          value={allClients.length}
          icon={Users}
          iconColor="#f59e0b"
          iconBg="rgba(245,158,11,0.1)"
          trend="Active"
          trendPositive
        />
        <StatCard
          label="Active Pets"
          value={petCount}
          icon={PawPrint}
          iconColor="#89A894"
          iconBg="rgba(137,168,148,0.12)"
          trend="Furry friends"
          trendPositive
        />
      </div>

      {/* Two-column Layout: Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* Today's Schedule */}
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-bold text-sm md:text-base">Today's Schedule</h2>
            <Link href="/appointments" className="flex items-center gap-1 text-[0.7rem] md:text-[0.78rem] text-sage-dark no-underline whitespace-nowrap">
              View Agenda <ArrowRight size={12} className="md:w-[13px] md:h-[13px]" />
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Clock size={32} className="mb-2 opacity-20" />
              <p style={{ fontSize: '0.875rem' }}>No more appointments today</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {todayAppointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.03)' }}>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white w-12 h-12 flex-shrink-0 shadow-sm">
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{apt.appointment_time.split(':')[0]}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{apt.appointment_time.split(':')[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{apt.pet.pet_name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{apt.service_type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span style={{ fontSize: '1.2rem' }}>{speciesEmoji[apt.pet.species || 'other']}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Clients */}
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-bold text-sm md:text-base">Recent Clients</h2>
            <Link href="/clients" className="flex items-center gap-1 text-[0.7rem] md:text-[0.78rem] text-sage-dark no-underline whitespace-nowrap">
              All Parents <ArrowRight size={12} className="md:w-[13px] md:h-[13px]" />
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No clients yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentClients.slice(0, 4).map(client => (
                <div key={client.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center rounded-full"
                      style={{ width: 32, height: 32, background: 'var(--sage-muted)', flexShrink: 0, fontWeight: 700, color: 'var(--sage-dark)', fontSize: '0.75rem' }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {formatCurrency(client.total_spend || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue insight hint */}
      <div
        className="mt-6 rounded-2xl p-5 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #89A894 0%, #6d8f7a 100%)', color: 'white' }}
      >
        <div className="flex items-center justify-center rounded-xl" style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
          <TrendingUp size={22} color="white" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.125rem' }}>Revenue Insight</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>
            Your top clients account for {allClients.length > 0 ? Math.min(allClients.length, 3) : 0} out of {allClients.length} pet parents. 
            Total spa earnings: <strong>{formatCurrency(totalRevenue)}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
