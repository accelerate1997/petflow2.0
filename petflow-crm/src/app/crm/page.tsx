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
    <div className="p-4 md:p-8 max-w-[100vw] pb-24 md:pb-8">
      {!isPocketBaseConfigured && <SetupBanner />}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Pet CRM 🌊</h1>
          <p className="text-gray-400 text-sm">
            Track your customers through the spa workflow
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative flex-1 md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Search pets..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
            />
          </div>
          <button className="btn-sage whitespace-nowrap" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      {/* CRM Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[
          { label: 'In Service', count: appointments.filter(a => a.status === 'InService').length, color: '#8b5cf6' },
          { label: 'Ready', count: appointments.filter(a => a.status === 'Done').length, color: '#10b981' },
          { label: 'Total', count: appointments.length, color: '#3b82f6' },
          { label: 'Leads', count: appointments.filter(a => a.status === 'Lead').length, color: '#f59e0b' },
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
