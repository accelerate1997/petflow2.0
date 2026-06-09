'use client'

import React from 'react'
import type { Appointment, AppointmentStatus } from '@/types'
import KanbanCard from './KanbanCard'

interface KanbanBoardProps {
  appointments: Appointment[]
  onMove: (id: string, newStatus: AppointmentStatus) => void
  onPaymentUpdate: (id: string, status: string) => void
  onRefresh: () => void
}

const columns: { key: AppointmentStatus; label: string; icon: string; color: string }[] = [
  { key: 'Lead',       label: 'Inquiry',     icon: '✨', color: '#f59e0b' },
  { key: 'Booked',     label: 'Booked',      icon: '📅', color: '#3b82f6' },
  { key: 'CheckedIn',  label: 'Checked In',  icon: '📍', color: '#6366f1' },
  { key: 'InService',  label: 'In Service',  icon: '✂️', color: '#8b5cf6' },
  { key: 'Done',       label: 'Service Done',icon: '✅', color: '#10b981' },
  { key: 'CheckOut', label: 'Checked Out', icon: '💎', color: '#64748b' },
]

export default function KanbanBoard({ appointments, onMove, onPaymentUpdate, onRefresh }: KanbanBoardProps) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-8 min-h-[70vh] items-start scrollbar-hide">
      {columns.map((col) => {
        const colAppointments = appointments.filter(a => a.status === col.key)
        
        return (
          <div 
            key={col.key} 
            className="flex-shrink-0 w-[300px] flex flex-col"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{col.icon}</span>
                <h3 className="font-700 text-[0.9rem] text-gray-800 uppercase tracking-wider">
                  {col.label}
                </h3>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[0.7rem] font-700">
                  {colAppointments.length}
                </span>
              </div>
              <div 
                className="h-1 w-12 rounded-full" 
                style={{ backgroundColor: col.color, opacity: 0.3 }}
              />
            </div>

            {/* Column Body */}
            <div 
              className="flex-1 rounded-2xl p-2 min-h-[500px] transition-colors bg-gray-50/50 border border-dashed border-gray-200"
            >
              {colAppointments.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-gray-300 text-[0.8rem] font-500 italic">
                  No items
                </div>
              ) : (
                colAppointments.map(apt => (
                  <KanbanCard 
                    key={apt.id} 
                    appointment={apt} 
                    onMove={onMove} 
                    onPaymentUpdate={onPaymentUpdate}
                    onRefresh={onRefresh}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
