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
            <div key={apt.id} className="bg-white rounded-2xl p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 shadow-sm border border-gray-100/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden mb-2">
              {/* Accent Background Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-sage-muted/10 rounded-full -mr-12 -mt-12 opacity-50" />
              
              <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
                {/* Time Block - Compact */}
                <div className="flex flex-col items-center justify-center p-2 md:p-3 rounded-xl bg-sage-muted text-sage-dark min-w-[70px] md:min-w-[80px] border border-sage/5">
                  <p className="font-900 text-sm md:text-lg tracking-tighter leading-none">{apt.appointment_time.slice(0, 5)}</p>
                  <p className="text-[0.5rem] md:text-[0.6rem] font-800 uppercase tracking-widest opacity-60 mt-1">
                    {new Date(apt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Pet Icon & Details with Mobile Spacing */}
                <div className="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-50 border border-white shadow-sm flex items-center justify-center text-xl md:text-2xl flex-shrink-0">
                    {speciesEmoji[apt.pets?.species || 'other']}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <h3 className="font-800 text-[0.95rem] md:text-[1.1rem] text-gray-800 tracking-tight truncate leading-none capitalize">
                        {apt.pets?.pet_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg bg-sage-muted text-sage-dark text-[0.55rem] font-800 uppercase tracking-widest border border-sage/10 whitespace-nowrap">
                        {apt.service_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <User size={10} className="opacity-50" />
                      <span className="text-[0.7rem] font-600 truncate">{apt.pets?.clients?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Status - Center Right (Hidden on mobile inside this flex, shown below) */}
                <div className="hidden lg:block mx-4">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.6rem] font-900 transition-all border active:scale-95"
                    style={{ 
                      backgroundColor: apt.payment_status === 'Pending' ? '#f9fafb' : 
                                       apt.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
                      color: apt.payment_status === 'Pending' ? '#9ca3af' : 
                             apt.payment_status === 'Cash' ? '#059669' : '#2563eb',
                      borderColor: apt.payment_status === 'Pending' ? '#f3f4f6' : 
                                   apt.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
                    }}
                  >
                    <span className="text-[0.8rem]">{apt.payment_status === 'Cash' ? '💵' : apt.payment_status === 'UPI' ? '📱' : '🕒'}</span>
                    <span className="uppercase tracking-widest">{apt.payment_status}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row / Mobile Actions */}
              <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50">
                {/* Mobile Payment Pill */}
                <div className="lg:hidden">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.6rem] font-900 border"
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
                    <span className="uppercase">{apt.payment_status}</span>
                  </button>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                  <div className="text-right">
                    <p className="text-[0.5rem] text-gray-400 font-800 uppercase tracking-widest">Fee</p>
                    <p className="font-900 text-[1.1rem] text-gray-800 tracking-tighter leading-none">{formatCurrency(apt.price)}</p>
                  </div>

                  <div className="flex gap-1.5">
                    {apt.status === 'Booked' && (
                      <>
                        <button
                          onClick={() => updateStatus(apt.id, 'Done')}
                          className="p-2 md:p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'Cancelled')}
                          className="p-2 md:p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                    {apt.status !== 'Booked' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'Booked')}
                        className="px-3 py-2 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-800 hover:text-white transition-all text-[0.6rem] font-800 uppercase tracking-widest"
                      >
                        Reschedule
                      </button>
                    )}
                  </div>
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
      <div className="fixed bottom-2 right-2 text-[10px] text-gray-300 pointer-events-none">v1.0.4</div>
    </div>
  )
}
