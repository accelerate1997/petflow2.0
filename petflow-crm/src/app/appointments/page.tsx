'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar as CalendarIcon, Plus, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, User } from 'lucide-react'
import BookAppointmentModal from '@/components/BookAppointmentModal'
import type { Appointment, AppointmentStatus } from '@/types'
import { getAppointments, updateAppointmentStatus, updatePaymentStatus } from '@/lib/actions'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [view, setView] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAppointments(view)
      const mapped = data.map((appt: any) => ({
        ...appt,
        pets: {
          ...appt.pet,
          clients: appt.pet.owner
        }
      })) as unknown as Appointment[]
      setAppointments(mapped)
    } catch (error: any) {
      console.error('Error fetching appointments:', error)
    }
    setLoading(false)
  }, [view])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(id, newStatus)
      fetchAppointments()
      router.refresh()
    } catch (error: any) {
      console.error('Error updating status:', error)
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Spa Schedule 📅</h1>
          <p className="text-gray-400 text-sm">
            Manage appointments and service queue
          </p>
        </div>
        <button className="btn-sage w-full md:w-auto justify-center" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Book Visit
        </button>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: '#f3f4f6' }}>
        {(['today', 'tomorrow', 'week', 'all'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              color: view === v ? 'var(--sage-dark)' : '#9ca3af',
              borderBottom: view === v ? '2px solid var(--sage)' : '2px solid transparent',
              transition: 'all 0.2s',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Agenda List */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card h-24 animate-pulse" style={{ background: '#f3f4f6' }} />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="card h-64 flex flex-col items-center justify-center text-center text-gray-400">
            <CalendarIcon size={48} className="mb-4 opacity-20" />
            <p className="font-600">No appointments scheduled</p>
            <p className="text-sm">Try choosing a different date range or book a new visit.</p>
          </div>
        ) : (
          appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-[2rem] p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 shadow-sm border border-gray-100/50 hover:shadow-xl transition-all duration-500 group relative overflow-hidden mb-2">
              {/* Accent Background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-sage-muted/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              
              {/* Time Section - Bold & Visual */}
              <div className="flex md:flex-col items-center justify-center p-3 md:p-5 rounded-[1.5rem] bg-sage-muted text-sage-dark min-w-[100px] shadow-sm">
                <p className="font-900 text-lg md:text-2xl tracking-tighter leading-none mb-0.5">{apt.appointment_time.slice(0, 5)}</p>
                <div className="md:w-full md:h-[1px] bg-sage-dark/10 my-1 hidden md:block" />
                <p className="text-[0.65rem] font-800 uppercase tracking-widest opacity-70 ml-2 md:ml-0">
                  {new Date(apt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>

              {/* Pet & Service Info */}
              <div className="flex-1 flex items-center gap-4 md:gap-6 min-w-0">
                <div className="w-16 h-16 rounded-[1.25rem] bg-gray-50 border-2 border-white shadow-md flex items-center justify-center text-3xl group-hover:rotate-6 transition-transform">
                  {speciesEmoji[apt.pets?.species || 'other']}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="font-900 text-[1.2rem] md:text-[1.3rem] text-gray-800 tracking-tight truncate leading-none">
                      {apt.pets?.pet_name}
                    </h3>
                    <span className="px-3 py-1 rounded-full bg-sage-muted/50 text-sage-dark text-[0.65rem] font-800 uppercase tracking-widest border border-sage/10">
                      {apt.service_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={10} className="text-gray-400" />
                    </div>
                    <span className="text-[0.8rem] font-600 truncate">{apt.pets?.clients?.name}</span>
                  </div>
                </div>
              </div>

              {/* Status & Price Pill Area */}
              <div className="flex items-center justify-between md:flex-col md:items-end gap-3 md:gap-2">
                <div className="md:text-right">
                  <p className="text-[0.6rem] text-gray-400 font-800 uppercase tracking-[0.2em] mb-0.5">Service Fee</p>
                  <p className="font-900 text-xl text-gray-800 tracking-tight leading-none">{formatCurrency(apt.price)}</p>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    const statuses = ['Pending', 'Cash', 'UPI'];
                    const nextIdx = (statuses.indexOf(apt.payment_status) + 1) % statuses.length;
                    updatePaymentStatus(apt.id, statuses[nextIdx]).then(() => {
                      fetchAppointments()
                      router.refresh()
                    })
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-[0.7rem] font-900 transition-all shadow-sm border active:scale-95"
                  style={{ 
                    backgroundColor: apt.payment_status === 'Pending' ? '#f9fafb' : 
                                     apt.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
                    color: apt.payment_status === 'Pending' ? '#9ca3af' : 
                           apt.payment_status === 'Cash' ? '#059669' : '#2563eb',
                    borderColor: apt.payment_status === 'Pending' ? '#f3f4f6' : 
                                 apt.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
                  }}
                >
                  <span className="text-lg">{apt.payment_status === 'Cash' ? '💵' : apt.payment_status === 'UPI' ? '📱' : '🕒'}</span>
                  <span className="uppercase tracking-[0.1em]">{apt.payment_status}</span>
                </button>
              </div>

              {/* Status Actions */}
              <div className="flex gap-2 border-t md:border-t-0 md:border-l border-gray-50 pt-4 md:pt-0 md:pl-6">
                {apt.status === 'Booked' && (
                  <>
                    <button
                      onClick={() => updateStatus(apt.id, 'Done')}
                      className="flex-1 md:flex-none p-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    >
                      <CheckCircle size={20} />
                    </button>
                    <button
                      onClick={() => updateStatus(apt.id, 'Cancelled')}
                      className="flex-1 md:flex-none p-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                    >
                      <XCircle size={20} />
                    </button>
                  </>
                )}
                {apt.status !== 'Booked' && (
                  <button
                    onClick={() => updateStatus(apt.id, 'Booked')}
                    className="w-full md:w-auto px-4 py-3 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-800 hover:text-white transition-all text-[0.7rem] font-800 uppercase tracking-widest"
                  >
                    Reschedule
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <BookAppointmentModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      <div className="fixed bottom-2 right-2 text-[10px] text-gray-300 pointer-events-none">v1.0.4</div>
    </div>
  )
}
