'use client'

import { useState } from 'react'
import { Clock, User, ChevronRight, ChevronLeft, CalendarClock, Scissors, Camera } from 'lucide-react'
import type { Appointment, AppointmentStatus } from '@/types'
import { statusStyles } from '@/types'
import RescheduleModal from './RescheduleModal'
import GroomingRecordModal from './GroomingRecordModal'
import CheckoutModal from './CheckoutModal'

interface KanbanCardProps {
  appointment: Appointment
  onMove: (id: string, newStatus: AppointmentStatus) => void
  onPaymentUpdate: (id: string, status: string) => void
  onRefresh: () => void
}

const statusOrder: AppointmentStatus[] = ['Lead', 'Booked', 'CheckedIn', 'InService', 'Done', 'CheckOut']

export default function KanbanCard({ appointment, onMove, onPaymentUpdate, onRefresh }: KanbanCardProps) {
  const [showReschedule, setShowReschedule] = useState(false)
  const [showGroomingRecord, setShowGroomingRecord] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const currentIndex = statusOrder.indexOf(appointment.status as AppointmentStatus)
  const nextStatus = currentIndex < statusOrder.length - 1 ? statusOrder[currentIndex + 1] : null
  const prevStatus = currentIndex > 0 ? statusOrder[currentIndex - 1] : null

  const handleNext = () => {
    if (!nextStatus) return
    // Intercept Done → CheckOut to open billing modal
    if (appointment.status === 'Done' && nextStatus === 'CheckOut') {
      setShowCheckout(true)
    } else {
      onMove(appointment.id, nextStatus)
    }
  }

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <>
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group overflow-hidden relative"
      style={{ marginBottom: '0.75rem' }}
    >
      {/* Status Accent Bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 opacity-70"
        style={{ backgroundColor: statusStyles[appointment.status as AppointmentStatus]?.bg.replace('bg-[', '').replace(']', '') || '#e5e7eb' }}
      />

      <div className="p-3 pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-muted flex items-center justify-center text-xl shadow-inner border border-white">
              {speciesEmoji[appointment.pet?.species || 'other']}
            </div>
            <div className="min-w-0">
              <h4 className="font-700 text-[0.85rem] text-gray-800 leading-tight truncate">
                {appointment.pet?.pet_name}
              </h4>
              <p className="text-[0.6rem] font-600 text-gray-400 uppercase tracking-tight flex items-center gap-1 mt-0.5">
                <User size={8} />
                <span className="truncate max-w-[70px]">{appointment.pet?.owner?.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowGroomingRecord(true)}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              title="Grooming Record"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}
            >
              <Camera size={13} />
            </button>
            <button
              onClick={() => setShowReschedule(true)}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              title="Reschedule"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
            >
              <CalendarClock size={13} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col items-center gap-0 px-2 py-1 bg-gray-50/80 rounded-lg">
            <div className="flex items-center gap-1">
              <Clock size={9} className="text-sage-dark opacity-50" />
              <span className="text-[0.65rem] font-700 text-gray-700">
                {appointment.appointment_time.slice(0, 5)}
              </span>
            </div>
            <span className="text-[0.55rem] font-600 text-gray-400 leading-tight">
              {new Date(appointment.appointment_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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

        {/* Groomer Badge */}
        {appointment.groomer && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg" style={{ background: 'var(--sage-muted)' }}>
            <Scissors size={9} style={{ color: 'var(--sage-dark)', opacity: 0.7 }} />
            <span className="text-[0.6rem] font-700 uppercase tracking-wider" style={{ color: 'var(--sage-dark)' }}>
              {appointment.groomer.name}
            </span>
          </div>
        )}

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
            onClick={handleNext}
            disabled={!nextStatus}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[0.6rem] font-800 transition-all ${!nextStatus ? 'opacity-0' : appointment.status === 'Done' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'bg-gray-800 text-white hover:bg-black shadow-sm'}`}
          >
            {appointment.status === 'Done' ? '🧾 Checkout' : 'Next'}
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>

    {showReschedule && (
      <RescheduleModal
        appointment={appointment}
        onClose={() => setShowReschedule(false)}
        onSuccess={() => {
          setShowReschedule(false)
          onRefresh()
        }}
      />
    )}

    {showGroomingRecord && (
      <GroomingRecordModal
        appointment={appointment}
        onClose={() => setShowGroomingRecord(false)}
        onSuccess={() => {
          setShowGroomingRecord(false)
          onRefresh()
        }}
      />
    )}

    {showCheckout && (
      <CheckoutModal
        appointment={appointment}
        onClose={() => setShowCheckout(false)}
        onSuccess={() => {
          setShowCheckout(false)
          onMove(appointment.id, 'CheckOut')
          onRefresh()
        }}
      />
    )}
  </>
  )
}
