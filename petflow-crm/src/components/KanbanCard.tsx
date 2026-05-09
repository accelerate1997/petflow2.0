'use client'

import { Clock, User, ChevronRight, ChevronLeft, MoreVertical } from 'lucide-react'
import type { Appointment, AppointmentStatus } from '@/types'
import { statusStyles } from '@/types'

interface KanbanCardProps {
  appointment: Appointment
  onMove: (id: string, newStatus: AppointmentStatus) => void
}

const statusOrder: AppointmentStatus[] = ['Lead', 'Booked', 'CheckedIn', 'InService', 'Done', 'CheckOut']

export default function KanbanCard({ appointment, onMove }: KanbanCardProps) {
  const currentIndex = statusOrder.indexOf(appointment.status)
  const nextStatus = currentIndex < statusOrder.length - 1 ? statusOrder[currentIndex + 1] : null
  const prevStatus = currentIndex > 0 ? statusOrder[currentIndex - 1] : null

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div 
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group"
      style={{ marginBottom: '0.75rem' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shadow-inner"
          >
            {speciesEmoji[appointment.pets?.species || 'other']}
          </div>
          <div>
            <h4 className="font-700 text-[0.9rem] text-gray-900 leading-tight">
              {appointment.pets?.pet_name}
            </h4>
            <div className="flex items-center gap-1 text-[0.7rem] text-gray-400 font-600">
              <User size={10} />
              <span className="truncate max-w-[80px]">{appointment.pets?.clients?.name}</span>
            </div>
          </div>
        </div>
        <button className="text-gray-300 hover:text-gray-500 transition-colors">
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-[0.75rem] text-gray-500 bg-gray-50/50 p-2 rounded-lg">
          <Clock size={12} className="text-gray-400" />
          <span className="font-600">{appointment.appointment_time.slice(0, 5)}</span>
          <span className="text-gray-300">•</span>
          <span className="truncate font-500">{appointment.service_type}</span>
        </div>
        
        <div className="relative">
          <select 
            value={appointment.payment_status}
            onChange={(e) => {
              // We'll need a way to trigger the update action here
              // Since this is a client component, we can call the server action directly
              import('@/lib/actions').then(m => m.updatePaymentStatus(appointment.id, e.target.value))
            }}
            className="appearance-none bg-gray-50 border-none text-[0.65rem] font-700 px-2 py-1 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors focus:ring-1 focus:ring-sage outline-none pr-6"
            style={{ 
              color: appointment.payment_status === 'Pending' ? '#9ca3af' : '#10b981',
            }}
          >
            <option value="Pending">🕒 Pending</option>
            <option value="Cash">💵 Cash</option>
            <option value="UPI">📱 UPI</option>
          </select>
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
            <ChevronRight size={10} className="rotate-90" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-50">
        {prevStatus && (
          <button 
            onClick={() => onMove(appointment.id, prevStatus)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={`Move to ${prevStatus}`}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div className="flex-1" />
        {nextStatus && (
          <button 
            onClick={() => onMove(appointment.id, nextStatus)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-sage-muted text-sage-dark hover:bg-sage hover:text-white transition-all font-700 text-[0.7rem]"
          >
            <span>Stage Up</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
