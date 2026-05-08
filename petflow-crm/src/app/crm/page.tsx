'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, Plus, Search, Filter } from 'lucide-react'
import KanbanBoard from '@/components/KanbanBoard'
import SetupBanner from '@/components/SetupBanner'
import { pb, isPocketBaseConfigured } from '@/lib/pocketbase'
import type { Appointment, AppointmentStatus } from '@/types'
import BookAppointmentModal from '@/components/BookAppointmentModal'

export default function PetCRMPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    if (!isPocketBaseConfigured) { setLoading(false); return }

    try {
      const records = await pb.collection('appointments').getFullList({
        sort: '-appointment_date,appointment_time',
        expand: 'pet_id,pet_id.owner_id',
      })
      
      // Map PocketBase expand to our Appointment type
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
    } catch (error: any) {
      if (!error.isAbort) {
        console.error('Error fetching appointments:', error)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleMove = async (id: string, newStatus: AppointmentStatus) => {
    // Optimistic update
    setAppointments(prev => 
      prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
    )

    try {
      await pb.collection('appointments').update(id, { status: newStatus })
    } catch (error: any) {
      console.error('Error updating status:', error)
      if (error.data) {
        console.error('Validation errors:', JSON.stringify(error.data, null, 2))
      }
      fetchAppointments() // Revert if failed
    }
  }


  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '100vw' }}>
      {!isPocketBaseConfigured && <SetupBanner />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>Pet CRM 🌊</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Track your customers through the spa workflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search pets..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
            />
          </div>
          <button className="btn-sage" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            New Interaction
          </button>
        </div>
      </div>

      {/* CRM Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active In Service', count: appointments.filter(a => a.status === 'InService').length, color: '#8b5cf6' },
          { label: 'Ready for Pickup', count: appointments.filter(a => a.status === 'Done').length, color: '#10b981' },
          { label: 'Today\'s Total', count: appointments.length, color: '#3b82f6' },
          { label: 'New Leads', count: appointments.filter(a => a.status === 'Lead').length, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
            <span className="text-[0.7rem] font-700 text-gray-400 uppercase tracking-wider">{stat.label}</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-800" style={{ color: stat.color }}>{stat.count}</span>
              <div 
                className="w-1.5 h-6 rounded-full" 
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
          appointments={appointments} 
          onMove={handleMove} 
        />
      )}

      {showModal && (
        <BookAppointmentModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchAppointments}
        />
      )}
    </div>
  )
}
