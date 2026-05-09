'use client'

import { Clock, User, ChevronRight, ChevronLeft, MoreVertical } from 'lucide-react'
import type { Appointment, AppointmentStatus } from '@/types'
import { statusStyles } from '@/types'

interface KanbanCardProps {
  appointment: Appointment
  onMove: (id: string, newStatus: AppointmentStatus) => void
  onPaymentUpdate: (id: string, status: string) => void
}

const statusOrder: AppointmentStatus[] = ['Lead', 'Booked', 'CheckedIn', 'InService', 'Done', 'CheckOut']

export default function KanbanCard({ appointment, onMove, onPaymentUpdate }: KanbanCardProps) {
  const currentIndex = statusOrder.indexOf(appointment.status)
  const nextStatus = currentIndex < statusOrder.length - 1 ? statusOrder[currentIndex + 1] : null
  const prevStatus = currentIndex > 0 ? statusOrder[currentIndex - 1] : null

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group overflow-hidden relative"
      style={{ marginBottom: '0.75rem' }}
    >
      {/* Status Accent Bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 opacity-70"
        style={{ backgroundColor: statusStyles[appointment.status]?.bg.replace('bg-[', '').replace(']', '') || '#e5e7eb' }}
      />

      <div className="p-3 pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-muted flex items-center justify-center text-xl shadow-inner border border-white">
              {speciesEmoji[appointment.pets?.species || 'other']}
            </div>
            <div className="min-w-0">
              <h4 className="font-700 text-[0.85rem] text-gray-800 leading-tight truncate">
                {appointment.pets?.pet_name}
              </h4>
              <p className="text-[0.6rem] font-600 text-gray-400 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                <User size={8} />
                <span className="truncate max-w-[70px]">{appointment.pets?.clients?.name}</span>
              </p>
            </div>
          </div>
          <button className="p-1 rounded-lg hover:bg-gray-50 text-gray-200 hover:text-gray-400 transition-colors">
            <MoreVertical size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50/80 rounded-lg">
            <Clock size={10} className="text-sage-dark opacity-50" />
            <span className="text-[0.65rem] font-700 text-gray-600">
              {appointment.appointment_time.slice(0, 5)}
            </span>
          </div>
          
          <button 
            type="button"
            onClick={() => {
              const statuses = ['Pending', 'Cash', 'UPI'];
              const nextIdx = (statuses.indexOf(appointment.payment_status) + 1) % statuses.length;
              onPaymentUpdate(appointment.id, statuses[nextIdx]);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6rem] font-800 transition-all active:scale-95 border"
            style={{ 
              backgroundColor: appointment.payment_status === 'Pending' ? '#f9fafb' : 
                               appointment.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
              color: appointment.payment_status === 'Pending' ? '#9ca3af' : 
                     appointment.payment_status === 'Cash' ? '#059669' : '#2563eb',
              borderColor: appointment.payment_status === 'Pending' ? '#f3f4f6' : 
                           appointment.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
            }}
          >
            <span className="text-[0.7rem]">
              {appointment.payment_status === 'Cash' ? '💵' : 
               appointment.payment_status === 'UPI' ? '📱' : '🕒'}
            </span>
            <span className="uppercase tracking-widest">{appointment.payment_status}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <button 
            onClick={() => prevStatus && onMove(appointment.id, prevStatus)}
            disabled={!prevStatus}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6rem] font-700 transition-all ${!prevStatus ? 'opacity-0' : 'text-gray-400 hover:text-sage-dark hover:bg-sage-muted'}`}
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          
          <span className="text-[0.6rem] font-700 text-gray-300 uppercase tracking-tighter">
            {appointment.service_type}
          </span>

          <button 
            onClick={() => nextStatus && onMove(appointment.id, nextStatus)}
            disabled={!nextStatus}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[0.6rem] font-800 transition-all ${!nextStatus ? 'opacity-0' : 'bg-gray-800 text-white hover:bg-black shadow-sm'}`}
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
