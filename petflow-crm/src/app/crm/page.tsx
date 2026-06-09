'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Sparkles, Plus, Search, Filter, X } from 'lucide-react'
import KanbanBoard from '@/components/KanbanBoard'
import type { Appointment, AppointmentStatus } from '@/types'
import BookAppointmentModal from '@/components/BookAppointmentModal'
import { getAppointments, updateAppointmentStatus, updatePaymentStatus, getStaff } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { getLocalDateString, addDays } from '@/lib/dateUtils'

export default function PetCRMPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week' | 'all'>('all')
  const [groomerFilter, setGroomerFilter] = useState('')
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([])
  const router = useRouter()

  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getAppointments()
      // Map Prisma include to our Appointment type
      const mapped = data.map((appt: any) => ({
        ...appt,
        pet: {
          ...appt.pet,
          owner: appt.pet.owner
        }
      })) as unknown as Appointment[]
      setAppointments(mapped)
    } catch (error: any) {
      console.error('Error fetching appointments:', error)
    }
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    fetchAppointments()
    getStaff(true).then(data => setStaffList(data as any)).catch(console.error)
  }, [fetchAppointments])

  const handleMove = async (id: string, newStatus: AppointmentStatus) => {
    console.log(`Moving appointment ${id} to ${newStatus}`);
    // Optimistic update
    setAppointments(prev => 
      prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
    )

    try {
      await updateAppointmentStatus(id, newStatus)
      await fetchAppointments(true)
      router.refresh()
    } catch (error: any) {
      console.error('Error updating status:', error)
      fetchAppointments() // Revert if failed
    }
  }

  const handlePaymentUpdate = async (id: string, payment_status: string) => {
    console.log(`Updating payment for ${id} to ${payment_status}`);
    
    // Optimistic update
    setAppointments(prev => {
      const next = prev.map(apt => apt.id === id ? { ...apt, payment_status } : apt);
      console.log('New appointments state set optimistically');
      return next;
    });

    try {
      const res = await updatePaymentStatus(id, payment_status)
      console.log('Server update successful:', res);
      await fetchAppointments(true)
      router.refresh()
    } catch (error: any) {
      console.error('Error updating payment status:', error)
      alert('Error updating payment: ' + (error.message || 'Unknown error'))
      fetchAppointments() // Revert if failed
    }
  }

  // ─── Client-side Filtering ─────────────────────────────────────
  const today = getLocalDateString()
  const tomorrow = getLocalDateString(addDays(new Date(), 1))
  const nextWeek = getLocalDateString(addDays(new Date(), 7))

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      // Date filter
      if (dateFilter === 'today' && apt.appointment_date !== today) return false
      if (dateFilter === 'tomorrow' && apt.appointment_date !== tomorrow) return false
      if (dateFilter === 'week' && (apt.appointment_date < today || apt.appointment_date > nextWeek)) return false
      // Groomer filter
      if (groomerFilter && apt.groomer_id !== groomerFilter) return false
      // Search
      if (search) {
        const q = search.toLowerCase()
        const petName = apt.pet?.pet_name?.toLowerCase() || ''
        const ownerName = apt.pet?.owner?.name?.toLowerCase() || ''
        if (!petName.includes(q) && !ownerName.includes(q)) return false
      }
      return true
    })
  }, [appointments, dateFilter, groomerFilter, search, today, tomorrow, nextWeek])

  const activeFilterCount = (dateFilter !== 'all' ? 1 : 0) + (groomerFilter ? 1 : 0)

  return (
    <div className="p-4 md:p-8 max-w-[100vw] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Pet CRM 🌊</h1>
          <p className="text-gray-400 text-sm">Track your customers through the spa workflow</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative flex-1 md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search pets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
            />
          </div>
          <button className="btn-sage whitespace-nowrap" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-2xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-1.5 mr-1">
          <Filter size={13} style={{ color: '#64748b' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Filter:</span>
        </div>

        {/* Date Tabs */}
        <div className="flex gap-1">
          {(['all', 'today', 'tomorrow', 'week'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className="px-3 py-1 rounded-lg text-[0.7rem] font-700 capitalize transition-all"
              style={{
                background: dateFilter === d ? '#1e293b' : 'white',
                color: dateFilter === d ? 'white' : '#64748b',
                border: '1px solid',
                borderColor: dateFilter === d ? '#1e293b' : '#e2e8f0',
              }}
            >
              {d === 'all' ? 'All Dates' : d === 'week' ? 'This Week' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Groomer Filter */}
        {staffList.length > 0 && (
          <select
            value={groomerFilter}
            onChange={e => setGroomerFilter(e.target.value)}
            className="ml-1 px-3 py-1 rounded-lg text-[0.7rem] font-600 bg-white border transition-all outline-none"
            style={{
              borderColor: groomerFilter ? '#6366f1' : '#e2e8f0',
              color: groomerFilter ? '#6366f1' : '#64748b',
              fontWeight: groomerFilter ? 700 : 600,
            }}
          >
            <option value="">✂️ All Groomers</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>✂️ {s.name}</option>
            ))}
          </select>
        )}

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setDateFilter('all'); setGroomerFilter('') }}
            className="flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg text-[0.7rem] font-700 transition-all"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
          >
            <X size={11} /> Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* CRM Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: 'In Service', count: filteredAppointments.filter(a => a.status === 'InService').length, color: '#8b5cf6' },
          { label: 'Ready', count: filteredAppointments.filter(a => a.status === 'Done').length, color: '#10b981' },
          { label: 'Showing', count: filteredAppointments.length, color: '#3b82f6' },
          { label: 'Leads', count: filteredAppointments.filter(a => a.status === 'Lead').length, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 md:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
            <span className="text-[0.6rem] md:text-[0.7rem] font-700 text-gray-400 uppercase tracking-wider">{stat.label}</span>
            <div className="flex items-end justify-between">
              <span className="text-xl md:text-2xl font-800" style={{ color: stat.color }}>{stat.count}</span>
              <div 
                className="w-1 md:w-1.5 h-4 md:h-6 rounded-full" 
                style={{ backgroundColor: stat.color, opacity: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-6 overflow-x-auto pb-8 min-h-[50vh]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[300px] h-64 bg-gray-50 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <KanbanBoard 
          appointments={filteredAppointments} 
          onMove={handleMove} 
          onPaymentUpdate={handlePaymentUpdate}
          onRefresh={() => { fetchAppointments(); router.refresh() }}
        />
      )}

      {showModal && (
        <BookAppointmentModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
