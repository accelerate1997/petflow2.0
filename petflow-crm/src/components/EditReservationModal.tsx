'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, BedDouble, Moon, IndianRupee, Phone } from 'lucide-react'
import type { BoardingReservation, BoardingRoom } from '@/types'
import { updateBoardingReservation } from '@/lib/actions'

interface Props {
  reservation: BoardingReservation
  rooms: BoardingRoom[]
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

function calcNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

export default function EditReservationModal({ reservation, rooms, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [form, setForm] = useState({
    room_id:           reservation.room_id,
    check_in_date:     reservation.check_in_date,
    check_out_date:    reservation.check_out_date,
    special_notes:     reservation.special_notes     || '',
    feeding_notes:     reservation.feeding_notes     || '',
    medication_notes:  reservation.medication_notes  || '',
    emergency_contact: reservation.emergency_contact || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const nights      = calcNights(form.check_in_date, form.check_out_date)
  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const totalAmount  = (selectedRoom?.price_per_night || 0) * nights

  // Rooms available for these dates (exclude conflicts, but allow current room)
  const availableRooms = rooms.filter(r => {
    if (r.status === 'Maintenance' && r.id !== form.room_id) return false
    const hasConflict = (r.reservations || []).some(res => {
      // Skip the reservation being edited
      if (res.id === reservation.id) return false
      if (['Cancelled', 'CheckedOut'].includes(res.status)) return false
      return res.check_in_date < form.check_out_date && res.check_out_date > form.check_in_date
    })
    return !hasConflict
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nights <= 0) { setError('Check-out must be after check-in'); return }
    if (!form.room_id) { setError('Please select a room'); return }

    setLoading(true); setError('')
    try {
      await updateBoardingReservation(reservation.id, {
        room_id:           form.room_id,
        check_in_date:     form.check_in_date,
        check_out_date:    form.check_out_date,
        total_nights:      nights,
        total_amount:      totalAmount,
        special_notes:     form.special_notes     || null,
        feeding_notes:     form.feeding_notes     || null,
        medication_notes:  form.medication_notes  || null,
        emergency_contact: form.emergency_contact || null,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error updating reservation')
    }
    setLoading(false)
  }

  const sizeEmojis: Record<string, string>  = { Small: '🐩', Medium: '🐕', Large: '🐕‍🦺', Cat: '🐱' }
  const typeColors: Record<string, string>  = { Standard: '#6b7280', Deluxe: '#d97706', Suite: '#7c3aed' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <Calendar size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Edit Reservation</h2>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                {reservation.pet?.pet_name} · {reservation.pet?.owner?.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 mb-4" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* ── Dates ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Check-in Date</label>
              <input className="input-field" type="date"
                value={form.check_in_date}
                onChange={e => setForm({ ...form, check_in_date: e.target.value })} />
            </div>
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Check-out Date</label>
              <input className="input-field" type="date"
                value={form.check_out_date}
                onChange={e => setForm({ ...form, check_out_date: e.target.value })} />
            </div>
          </div>

          {/* ── Room Selection ── */}
          <div>
            <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-2 block">
              Room ({availableRooms.length} available for these dates)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {availableRooms.map(r => {
                const active = form.room_id === r.id
                const isCurrent = r.id === reservation.room_id
                return (
                  <button key={r.id} type="button"
                    onClick={() => setForm({ ...form, room_id: r.id })}
                    className="text-left p-3 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: active ? 'var(--sage-dark)' : '#e5e7eb',
                      background:  active ? 'var(--sage-muted)' : 'white',
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-700 text-sm">{r.name}</span>
                      <div className="flex items-center gap-1">
                        {isCurrent && <span className="text-[0.55rem] font-700 px-1 py-0.5 rounded" style={{ background: '#f0fdf4', color: '#16a34a' }}>current</span>}
                        <span className="text-base">{sizeEmojis[r.size_category] || '🐾'}</span>
                      </div>
                    </div>
                    <p className="text-[0.65rem] font-600" style={{ color: typeColors[r.room_type] || '#6b7280' }}>
                      {r.room_type} · {r.size_category}
                    </p>
                    <p className="text-[0.7rem] font-800 mt-1" style={{ color: 'var(--sage-dark)' }}>
                      {currencySymbol}{r.price_per_night}/night
                    </p>
                  </button>
                )
              })}
            </div>
            {availableRooms.length === 0 && (
              <div className="rounded-xl p-4 text-center text-sm text-gray-400 border-2 border-dashed">
                No rooms available for selected dates
              </div>
            )}
          </div>

          {/* ── Price Summary ── */}
          {nights > 0 && selectedRoom && (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--sage-muted)' }}>
              <div className="flex items-center gap-2">
                <Moon size={16} style={{ color: 'var(--sage-dark)' }} />
                <span className="text-sm font-600">{nights} night{nights > 1 ? 's' : ''} × {currencySymbol}{selectedRoom.price_per_night}</span>
              </div>
              <span className="font-800 text-lg" style={{ color: 'var(--sage-dark)' }}>{currencySymbol}{totalAmount.toLocaleString()}</span>
            </div>
          )}

          {/* ── Care Instructions ── */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb' }}>
            <p className="text-[0.75rem] font-700 text-gray-600 mb-1">📋 Care Instructions</p>

            <div>
              <label className="block text-[0.72rem] font-600 text-gray-500 mb-1">🍖 Feeding Schedule / Diet</label>
              <textarea className="input-field" rows={2}
                placeholder="e.g. 2x daily, Royal Canin dry food 100g..."
                value={form.feeding_notes}
                onChange={e => setForm({ ...form, feeding_notes: e.target.value })} />
            </div>

            <div>
              <label className="block text-[0.72rem] font-600 text-gray-500 mb-1">💊 Medication</label>
              <textarea className="input-field" rows={2}
                placeholder="e.g. 1 tablet of XYZ every morning..."
                value={form.medication_notes}
                onChange={e => setForm({ ...form, medication_notes: e.target.value })} />
            </div>

            <div>
              <label className="block text-[0.72rem] font-600 text-gray-500 mb-1">📝 Special Instructions</label>
              <textarea className="input-field" rows={2}
                placeholder="Allergies, behavioral notes, favorite toy..."
                value={form.special_notes}
                onChange={e => setForm({ ...form, special_notes: e.target.value })} />
            </div>

            <div>
              <label className="block text-[0.72rem] font-600 text-gray-500 mb-1 flex items-center gap-1">
                <Phone size={11} /> Emergency Contact
              </label>
              <input className="input-field"
                placeholder="Name & phone number"
                value={form.emergency_contact}
                onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
