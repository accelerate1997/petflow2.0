'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar as CalendarIcon, Plus, Clock, CheckCircle, XCircle, User, CalendarClock, Camera, Receipt, FileText } from 'lucide-react'
import BookAppointmentModal from '@/components/BookAppointmentModal'
import RescheduleModal from '@/components/RescheduleModal'
import GroomingRecordModal from '@/components/GroomingRecordModal'
import CheckoutModal from '@/components/CheckoutModal'
import type { Appointment, AppointmentStatus } from '@/types'
import { getAppointments, updateAppointmentStatus, updatePaymentStatus, getInvoice, getSettings } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { getLocalDateString } from '@/lib/dateUtils'

export const dynamic = 'force-dynamic'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [view, setView] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [groomingRecordAppt, setGroomingRecordAppt] = useState<Appointment | null>(null)
  const [checkoutAppt, setCheckoutAppt] = useState<Appointment | null>(null)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  const router = useRouter()

  useEffect(() => {
    getSettings().then(settings => {
      if (settings) {
        setCurrencyCode(settings.currency_code || 'INR')
        setCurrencySymbol(settings.currency_symbol || '₹')
      }
    })
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const clientTodayStr = getLocalDateString(new Date())
      const data = await getAppointments(view, clientTodayStr)
      setAppointments(data)
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

  const formatCurrency = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(n)
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    }
  }

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
            <div key={apt.id} className="bg-white rounded-xl p-2.5 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 mb-1.5 group relative overflow-hidden">
              {/* Main Info Row */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sage-muted flex items-center justify-center text-lg flex-shrink-0 border border-white/50">
                    {speciesEmoji[apt.pet?.species || 'other']}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-800 text-[0.95rem] text-gray-800 tracking-tight leading-none truncate capitalize">
                      {apt.pet?.pet_name}
                    </h3>
                    <p className="text-[0.55rem] font-700 text-sage-dark/60 uppercase tracking-widest mt-0.5 truncate">{apt.service_type}</p>
                  </div>
                </div>
                <div className="bg-gray-800 text-white px-2 py-1 rounded-lg shadow-sm flex-shrink-0 text-center min-w-[55px]">
                  <p className="font-800 text-[0.7rem] leading-none">{apt.appointment_time.slice(0, 5)}</p>
                  <p className="text-[0.4rem] font-700 opacity-60 uppercase tracking-tighter mt-0.5">
                    {new Date(apt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Bottom Details Row */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                    <User size={8} className="text-gray-400" />
                  </div>
                  <span className="text-[0.65rem] font-700 text-gray-500 truncate">{apt.pet?.owner?.name}</span>
                  
                  {/* Compact Payment Pill */}
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.5rem] font-900 border transition-all active:scale-95 ml-auto sm:ml-2"
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

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-right mr-1">
                    <p className="font-800 text-[0.85rem] text-gray-800 tracking-tighter leading-none">{formatCurrency(apt.price || 0)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {apt.status === 'Booked' && (
                      <>
                        <button
                          onClick={() => updateStatus(apt.id, 'Done')}
                          className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                          title="Mark as Done"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'Cancelled')}
                          className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100"
                          title="Cancel"
                        >
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                    {apt.status === 'Done' && (
                      <button
                        onClick={() => setCheckoutAppt(apt)}
                        className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all border border-amber-100"
                        title="Checkout & Invoice"
                      >
                        <Receipt size={14} />
                      </button>
                    )}
                    {apt.status === 'CheckOut' && (
                      <button
                        onClick={() => router.push('/billing')}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-600 hover:text-white transition-all border border-slate-200"
                        title="View in Billing"
                      >
                        <FileText size={14} />
                      </button>
                    )}
                    {/* Grooming Record button — always visible */}
                    <button
                      onClick={() => setGroomingRecordAppt(apt)}
                      className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all border border-purple-100"
                      title="Grooming Record"
                    >
                      <Camera size={14} />
                    </button>
                    {/* Reschedule button — always visible */}
                    <button
                      onClick={() => setRescheduleAppt(apt)}
                      className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                      title="Reschedule"
                    >
                      <CalendarClock size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <BookAppointmentModal
          currencySymbol={currencySymbol}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {rescheduleAppt && (
        <RescheduleModal
          currencySymbol={currencySymbol}
          appointment={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {groomingRecordAppt && (
        <GroomingRecordModal
          appointment={groomingRecordAppt}
          onClose={() => setGroomingRecordAppt(null)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {checkoutAppt && (
        <CheckoutModal
          appointment={checkoutAppt}
          onClose={() => setCheckoutAppt(null)}
          onSuccess={() => {
            setCheckoutAppt(null)
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      <div className="fixed bottom-2 right-2 text-[10px] text-gray-300 pointer-events-none">v1.1.0</div>
    </div>
  )
}
