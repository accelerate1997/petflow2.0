'use client'

import { useEffect, useState } from 'react'
import { PawPrint, IndianRupee, Users, TrendingUp, Calendar, ArrowRight, Clock } from 'lucide-react'
import StatCard from '@/components/StatCard'
import SetupBanner from '@/components/SetupBanner'
import { pb, isPocketBaseConfigured } from '@/lib/pocketbase'
import type { Client, Pet, Appointment } from '@/types'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalPets: 0,
    totalRevenue: 0,
    totalClients: 0,
    newThisMonth: 0,
    appointmentsToday: 0,
  })
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isPocketBaseConfigured) { setLoading(false); return }
      
      const today = new Date().toISOString().split('T')[0]

      try {
        const [petsRes, clientsRes, appointmentsRes] = await Promise.all([
          pb.collection('pets').getList(1, 1, { fields: 'id', totalItems: true }),
          pb.collection('clients').getFullList({ fields: 'id,total_spend,join_date,name,created' }),
          pb.collection('appointments').getFullList({
            filter: `appointment_date = "${today}"`,
            sort: 'appointment_time',
            expand: 'pet_id',
          }),
        ])

        const revenue = (clientsRes || []).reduce((sum: number, c: any) => sum + (c.total_spend || 0), 0)
        const thisMonth = new Date()
        const newClients = (clientsRes || []).filter((c: any) => {
          const d = new Date(c.join_date || c.created)
          return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear()
        }).length

        setStats({
          totalPets: petsRes.totalItems || 0,
          totalRevenue: revenue,
          totalClients: (clientsRes || []).length,
          newThisMonth: newClients,
          appointmentsToday: (appointmentsRes || []).length,
        })
        
        // Map recent clients (sorted by created)
        const sortedClients = [...clientsRes].sort((a, b) => 
          new Date(b.created).getTime() - new Date(a.created).getTime()
        ).slice(0, 5)
        setRecentClients(sortedClients as unknown as Client[])

        // Map upcoming appointments
        const mappedApts = appointmentsRes.map(record => ({
          ...record,
          pets: record.expand?.pet_id ? {
            pet_name: record.expand.pet_id.pet_name,
            species: record.expand.pet_id.species,
          } : { pet_name: 'Unknown', species: 'other' }
        }))
        setUpcomingAppointments(mappedApts as unknown as Appointment[])

      } catch (error: any) {
        if (!error.isAbort) {
          console.error('Error loading dashboard stats:', error)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] pb-24 md:pb-8">
      {!isPocketBaseConfigured && <SetupBanner />}

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
          value={loading ? '—' : stats.appointmentsToday}
          icon={Calendar}
          iconColor="#3b82f6"
          iconBg="rgba(59, 130, 246, 0.12)"
          trend={loading ? undefined : `${stats.appointmentsToday} scheduled`}
          trendPositive
        />
        <StatCard
          label="Total Revenue"
          value={loading ? '—' : formatCurrency(stats.totalRevenue)}
          icon={IndianRupee}
          iconColor="#8b5cf6"
          iconBg="rgba(139,92,246,0.1)"
          trend="All time"
          trendPositive
        />
        <StatCard
          label="Pet Parents"
          value={loading ? '—' : stats.totalClients}
          icon={Users}
          iconColor="#f59e0b"
          iconBg="rgba(245,158,11,0.1)"
          trend="Active"
          trendPositive
        />
        <StatCard
          label="Active Pets"
          value={loading ? '—' : stats.totalPets}
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
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Today's Schedule</h2>
            <Link href="/appointments" style={{ fontSize: '0.78rem', color: 'var(--sage-dark)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View Agenda <ArrowRight size={13} />
            </Link>
          </div>
          {loading ? (
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading schedule...</div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Clock size={32} className="mb-2 opacity-20" />
              <p style={{ fontSize: '0.875rem' }}>No more appointments today</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingAppointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.03)' }}>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white w-12 h-12 flex-shrink-0 shadow-sm">
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{apt.appointment_time.split(':')[0]}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{apt.appointment_time.split(':')[1]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{(apt as any).pets?.pet_name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{apt.service_type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span style={{ fontSize: '1.2rem' }}>{speciesEmoji[(apt as any).pets?.species || 'other']}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Clients */}
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Recent Clients</h2>
            <Link href="/clients" style={{ fontSize: '0.78rem', color: 'var(--sage-dark)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              All Parents <ArrowRight size={13} />
            </Link>
          </div>
          {loading ? (
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading...</div>
          ) : recentClients.length === 0 ? (
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

      {/* Revenue breakdown hint */}
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
            Your top clients account for {stats.totalClients > 0 ? Math.min(stats.totalClients, 3) : 0} out of {stats.totalClients} pet parents. 
            Total spa earnings: <strong>{formatCurrency(stats.totalRevenue)}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
