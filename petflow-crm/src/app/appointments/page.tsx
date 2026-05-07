'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar as CalendarIcon, Plus, Search, MapPin, Clock, MoreVertical, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import BookAppointmentModal from '@/components/BookAppointmentModal'
import SetupBanner from '@/components/SetupBanner'
import { pb, isPocketBaseConfigured } from '@/lib/pocketbase'
import type { Appointment, AppointmentStatus } from '@/types'
import { statusStyles } from '@/types'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [view, setView] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    if (!isPocketBaseConfigured) { setLoading(false); return }

    // Building the date range query
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    try {
      let filter = ''
      if (view === 'today') filter = `appointment_date ~ "${today}"`
      else if (view === 'tomorrow') filter = `appointment_date ~ "${tomorrow}"`
      else if (view === 'week') filter = `appointment_date >= "${today} 00:00:00" && appointment_date <= "${nextWeek} 23:59:59"`

      const records = await pb.collection('appointments').getFullList({
        filter,
        sort: 'appointment_date,appointment_time',
        expand: 'pet_id,pet_id.owner_id',
      })
      
      const mapped = records.map(record => ({
        ...record,
        pets: record.expand?.pet_id ? {
          ...record.expand.pet_id,
          clients: record.expand.pet_id.expand?.owner_id ? {
            name: record.expand.pet_id.expand.owner_id.name
          } : undefined
        } : undefined
      })) as unknown as Appointment[]

      setAppointments(mapped)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    }
    setLoading(false)
  }, [view])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await pb.collection('appointments').update(id, { status: newStatus })
      fetchAppointments()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1100 }}>
      {!isPocketBaseConfigured && <SetupBanner />}

      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>Spa Schedule 📅</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Manage appointments and service queue
          </p>
        </div>
        <button className="btn-sage" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Book Visit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: '#f3f4f6' }}>
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
              cursor: 'pointer'
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
            <div key={apt.id} className="card p-5 flex items-center gap-5">
              {/* Time Section */}
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl" style={{ width: 80, background: 'var(--sage-muted)', color: 'var(--sage-dark)' }}>
                <Clock size={16} className="mb-1" />
                <p className="font-700 text-sm">{apt.appointment_time.slice(0, 5)}</p>
                <p className="text-[0.65rem] font-600 opacity-60 uppercase">{new Date(apt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </div>

              {/* Pet Info */}
              <div
                className="flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{ width: 48, height: 48, background: '#f9fafb', fontSize: '1.4rem' }}
              >
                {speciesEmoji[apt.pets?.species || 'other']}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-700 text-[1rem]">{apt.pets?.pet_name}</p>
                  <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${statusStyles[apt.status].bg} ${statusStyles[apt.status].color}`}>
                    {apt.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-600 color-sage-dark">{apt.service_type}</span>
                  <span>•</span>
                  <span>{apt.pets?.clients?.name} (Parent)</span>
                </div>
              </div>

              {/* Actions & Price */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[0.65rem] text-gray-400 font-600 uppercase">Service Fee</p>
                  <p className="font-700">{formatCurrency(apt.price)}</p>
                </div>
                <div className="flex gap-1.5">
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
          onSuccess={fetchAppointments}
        />
      )}
    </div>
  )
}
