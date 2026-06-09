'use client'

import { X, Calendar, User, Heart, Backpack, Info, Phone } from 'lucide-react'
import type { BoardingReservation } from '@/types'
import { formatCurrency } from '@/lib/currency'

interface CheckInSheetModalProps {
  reservation: BoardingReservation
  onClose: () => void
  currencyCode?: string
}

export default function CheckInSheetModal({ reservation, onClose, currencyCode = 'INR' }: CheckInSheetModalProps) {
  const pet = reservation.pet
  const owner = pet?.owner
  const fmt = (n: number) => formatCurrency(n, currencyCode)

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-[550px] flex flex-col p-6 rounded-2xl relative bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              📄 Check-in Sheet
            </h2>
            <p className="text-xs text-gray-400">
              Boarding Stay Record for <span className="font-semibold text-sage-dark">{pet?.pet_name}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="space-y-5 py-4 flex-1 overflow-y-auto">
          {/* Guest and Owner Summary */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs border border-gray-100">
            <div>
              <p className="text-gray-400 font-semibold uppercase tracking-wider mb-1">🐾 Guest Details</p>
              <p className="font-bold text-gray-700">{pet?.pet_name}</p>
              <p className="text-gray-500">{pet?.species || 'Dog'} · {pet?.breed || 'Mixed Breed'}</p>
              <p className="text-gray-500">Scheduled: {reservation.check_in_date} to {reservation.check_out_date}</p>
            </div>
            <div>
              <p className="text-gray-400 font-semibold uppercase tracking-wider mb-1">👤 Owner Details</p>
              <p className="font-bold text-gray-700">{owner?.name}</p>
              <p className="text-gray-500 flex items-center gap-1 mt-0.5">
                <Phone size={11} className="text-gray-400" /> {owner?.whatsapp_number || 'N/A'}
              </p>
              {reservation.emergency_contact && (
                <p className="text-gray-500 mt-1 font-medium">
                  🚨 Emergency: {reservation.emergency_contact}
                </p>
              )}
            </div>
          </div>

          {/* Core Check-in Information */}
          <div className="space-y-4">
            {/* Weight & Belongings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">⚖️ Checked-in Weight</p>
                <p className="text-base font-bold text-gray-800">
                  {reservation.check_in_weight ? `${reservation.check_in_weight} kg` : 'Not recorded'}
                </p>
              </div>
              <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">🎒 Belongings</p>
                <p className="text-xs text-gray-600 line-clamp-3">
                  {reservation.check_in_belongings || 'None'}
                </p>
              </div>
            </div>

            {/* Health & Skin Inspection */}
            <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">🩺 Skin & Health Checklist</p>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">
                {reservation.check_in_health || 'No conditions logged'}
              </p>
            </div>

            {/* Feeding & Medication Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">🍖 Feeding Schedule</p>
                <p className="text-xs text-gray-600">
                  {reservation.feeding_notes || 'Standard feeding'}
                </p>
              </div>
              <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">💊 Medications</p>
                <p className="text-xs text-gray-600">
                  {reservation.medication_notes || 'None'}
                </p>
              </div>
            </div>

            {/* Added Services and Products during Stay */}
            {((reservation.appointments && reservation.appointments.length > 0) || (reservation.sales && reservation.sales.length > 0)) && (
              <div className="border border-gray-100 p-3.5 rounded-xl bg-white shadow-sm space-y-2.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">💈 Added Spa & Products during Stay</p>
                <div className="space-y-2">
                  {/* Appointments */}
                  {reservation.appointments?.map((appt) => (
                    <div key={appt.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-bold text-gray-700">💈 {appt.service_type}</p>
                        <p className="text-[10px] text-gray-400">Date: {appt.appointment_date} · Staff: {appt.groomer?.name || 'Staff'}</p>
                      </div>
                      <span className="font-bold text-sage-dark">{fmt(appt.price || 0)}</span>
                    </div>
                  ))}
                  {/* Sales */}
                  {reservation.sales?.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-bold text-gray-700">🍖 {s.product?.name} (x{s.quantity})</p>
                        <p className="text-[10px] text-gray-400">Category: {s.product?.category || 'Retail'}</p>
                      </div>
                      <span className="font-bold text-sage-dark">{fmt(s.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Care Timeline Feed */}
            {reservation.care_logs && reservation.care_logs.length > 0 ? (
              <div className="border border-gray-100 p-4 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">📅 Daily Care logs Timeline</p>
                <div className="relative pl-5 border-l-2 border-gray-100 space-y-4">
                  {reservation.care_logs.map((log) => {
                    const timeStr = new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                    return (
                      <div key={log.id} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[27.5px] top-1 bg-white border-2 border-sage rounded-full w-3.5 h-3.5 flex items-center justify-center" />
                        <div className="text-xs">
                          <div className="flex items-center justify-between font-bold text-gray-700">
                            <span className="flex items-center gap-1">
                              <span>{log.activity_type === 'Feeding' ? '🍖' : log.activity_type === 'Medication' ? '💊' : log.activity_type === 'Potty' ? '🌳' : log.activity_type === 'Mood' ? '✨' : '📋'}</span>
                              {log.activity_type} · {log.status}
                            </span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {timeStr} ({log.date})
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-gray-500 mt-1 leading-relaxed">{log.notes}</p>
                          )}
                          {log.photo_url && (
                            <div className="mt-2 w-full max-w-[220px] border border-gray-100 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                              <img src={log.photo_url} alt="Activity attachment" className="max-h-32 w-full object-cover" />
                            </div>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">Logged by: {log.logged_by || 'Staff'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-gray-100 p-4 rounded-xl bg-white shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">📅 Daily Care Logs</p>
                <p className="text-xs text-gray-400 italic">No care logs recorded for this stay yet.</p>
              </div>
            )}

            {/* Consent & Owner Signature */}
            {reservation.check_in_signature && (
              <div className="border border-gray-100 p-4 rounded-xl bg-white shadow-sm flex flex-col items-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 self-start">✍️ Consent Signature</p>
                <div className="border border-dashed border-gray-200 rounded-lg p-2 bg-gray-50/50 w-full max-w-[360px] flex justify-center">
                  {/* Embedded image to render signature */}
                  <img 
                    src={reservation.check_in_signature} 
                    alt="Owner Signature" 
                    className="max-h-24 object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-sage py-2 px-6"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  )
}
