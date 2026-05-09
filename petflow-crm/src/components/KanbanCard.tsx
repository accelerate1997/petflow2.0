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
      className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group overflow-hidden relative"
      style={{ marginBottom: '1rem' }}
    >
      {/* Status Accent Bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80"
        style={{ backgroundColor: statusStyles[appointment.status]?.bg.replace('bg-[', '').replace(']', '') || '#e5e7eb' }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sage-muted flex items-center justify-center text-2xl shadow-sm border border-white">
              {speciesEmoji[appointment.pets?.species || 'other']}
            </div>
            <div>
              <h4 className="font-700 text-[1rem] text-gray-800 leading-tight">
                {appointment.pets?.pet_name}
              </h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[0.65rem] font-600 text-gray-400 uppercase tracking-tight flex items-center gap-1">
                  <User size={10} className="text-gray-300" />
                  {appointment.pets?.clients?.name}
                </span>
              </div>
            </div>
          </div>
          <button className="p-1.5 rounded-xl hover:bg-gray-50 text-gray-300 hover:text-gray-500 transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-xl border border-gray-100/50">
              <Clock size={12} className="text-sage-dark opacity-60" />
              <span className="text-[0.75rem] font-700 text-gray-700">
                {appointment.appointment_time.slice(0, 5)}
              </span>
            </div>
            <span className="text-[0.7rem] font-700 px-2.5 py-1.5 bg-sage-muted text-sage-dark rounded-xl uppercase tracking-wider">
              {appointment.service_type}
            </span>
          </div>

          <button 
            type="button"
            onClick={() => {
              const statuses = ['Pending', 'Cash', 'UPI'];
              const nextIdx = (statuses.indexOf(appointment.payment_status) + 1) % statuses.length;
              onPaymentUpdate(appointment.id, statuses[nextIdx]);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[0.75rem] font-800 transition-all active:scale-[0.98] border border-transparent"
            style={{ 
              backgroundColor: appointment.payment_status === 'Pending' ? '#f3f4f6' : 
                               appointment.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
              color: appointment.payment_status === 'Pending' ? '#6b7280' : 
                     appointment.payment_status === 'Cash' ? '#059669' : '#2563eb',
              borderColor: appointment.payment_status === 'Pending' ? 'transparent' : 
                           appointment.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
            }}
          >
            {appointment.payment_status === 'Cash' ? <span className="text-lg">💵</span> : 
             appointment.payment_status === 'UPI' ? <span className="text-lg">📱</span> : <span className="text-lg">🕒</span>}
            <span className="uppercase tracking-widest">{appointment.payment_status}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <button 
            onClick={() => prevStatus && onMove(appointment.id, prevStatus)}
            disabled={!prevStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[0.65rem] font-700 transition-all ${!prevStatus ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-sage-dark hover:bg-sage-muted'}`}
          >
            <ChevronLeft size={14} />
            Back
          </button>
          
          <button 
            onClick={() => nextStatus && onMove(appointment.id, nextStatus)}
            disabled={!nextStatus}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[0.65rem] font-800 transition-all ${!nextStatus ? 'opacity-0 pointer-events-none' : 'bg-gray-800 text-white hover:bg-black shadow-sm'}`}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
