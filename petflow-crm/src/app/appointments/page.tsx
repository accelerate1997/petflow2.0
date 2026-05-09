'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar as CalendarIcon, Plus, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
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
            <div key={apt.id} className="bg-white rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden">
              {/* Accent Bar */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1 opacity-60"
                style={{ background: 'var(--sage)' }}
              />

              {/* Time Section */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl min-w-[60px]" style={{ background: 'var(--sage-muted)', color: 'var(--sage-dark)' }}>
                <Clock size={12} className="mb-0.5 opacity-70" />
                <p className="font-800 text-[0.75rem] leading-none mb-0.5">{apt.appointment_time.slice(0, 5)}</p>
                <p className="text-[0.55rem] font-700 opacity-60 uppercase tracking-tighter">
                  {new Date(apt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>

              {/* Pet Avatar */}
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0 bg-gray-50 border border-white"
                style={{ width: 40, height: 40, fontSize: '1.2rem' }}
              >
                {speciesEmoji[apt.pets?.species || 'other']}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <p className="font-800 text-[0.9rem] text-gray-800 truncate leading-tight mb-1">{apt.pets?.pet_name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[0.6rem] font-800 text-sage-dark uppercase tracking-wider bg-sage-muted px-1.5 py-0.5 rounded-lg">{apt.service_type}</span>
                  <span className="text-[0.6rem] font-600 text-gray-400 truncate max-w-[80px]">{apt.pets?.clients?.name}</span>
                </div>
              </div>

              {/* Status & Price */}
              <div className="flex items-center gap-3 md:gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-[0.55rem] text-gray-400 font-700 uppercase tracking-widest">Fee</p>
                  <p className="font-800 text-[0.95rem] text-gray-800">{formatCurrency(apt.price)}</p>
                  
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
                    className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.55rem] font-800 transition-all border shadow-sm"
                    style={{ 
                      backgroundColor: apt.payment_status === 'Pending' ? '#f9fafb' : 
                                       apt.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
                      color: apt.payment_status === 'Pending' ? '#9ca3af' : 
                             apt.payment_status === 'Cash' ? '#059669' : '#2563eb',
                      borderColor: apt.payment_status === 'Pending' ? '#f3f4f6' : 
                                   apt.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
                    }}
                  >
                    <span>{apt.payment_status === 'Cash' ? '💵' : apt.payment_status === 'UPI' ? '📱' : '🕒'}</span>
                    <span className="uppercase tracking-widest">{apt.payment_status}</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  {apt.status === 'Booked' && (
                    <>
                      <button
                        title="Mark Completed"
                        onClick={() => updateStatus(apt.id, 'Done')}
                        className="p-2 rounded-xl border border-emerald-100 hover:bg-emerald-50 text-emerald-600 transition-colors"
                      >
                        <CheckCircle size={18} />
                      </button>
                      <button
                        title="Cancel"
                        onClick={() => updateStatus(apt.id, 'Cancelled')}
                        className="p-2 rounded-xl border border-red-100 hover:bg-red-50 text-red-600 transition-colors"
                      >
                        <XCircle size={18} />
                      </button>
                    </>
                  )}
                  {apt.status !== 'Booked' && (
                    <button
                      title="Re-schedule"
                      onClick={() => updateStatus(apt.id, 'Booked')}
                      className="p-2 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-400 transition-colors"
                    >
                      <AlertCircle size={18} />
                    </button>
                  )}
                </div>
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
    </div>
  )
}
