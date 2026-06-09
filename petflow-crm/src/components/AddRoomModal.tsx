'use client'

import { useState } from 'react'
import { X, BedDouble } from 'lucide-react'
import { createBoardingRoom, updateBoardingRoom } from '@/lib/actions'
import type { BoardingRoom } from '@/types'

interface Props {
  room?: BoardingRoom | null
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

const ROOM_TYPES   = ['Standard', 'Deluxe', 'Suite']
const SIZE_CATS    = ['Small', 'Medium', 'Large', 'Cat']
const PET_TYPES    = [{ value: 'all', label: 'All Pets' }, { value: 'dog', label: 'Dogs Only' }, { value: 'cat', label: 'Cats Only' }]

const SIZE_COLORS: Record<string, { bg: string; color: string; emoji: string }> = {
  Small:  { bg: '#f0fdf4', color: '#16a34a', emoji: '🐩' },
  Medium: { bg: '#fffbeb', color: '#d97706', emoji: '🐕' },
  Large:  { bg: '#fef2f2', color: '#dc2626', emoji: '🐕‍🦺' },
  Cat:    { bg: '#eff6ff', color: '#2563eb', emoji: '🐱' },
}

export default function AddRoomModal({ room, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [form, setForm] = useState({
    name:            room?.name            || '',
    room_type:       room?.room_type       || 'Standard',
    size_category:   room?.size_category   || 'Medium',
    pet_type:        room?.pet_type        || 'all',
    price_per_night: room?.price_per_night?.toString() || '',
    capacity:        room?.capacity?.toString() || '1',
    notes:           room?.notes           || '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name)            { setError('Room name is required'); return }
    if (!form.price_per_night) { setError('Price per night is required'); return }

    setLoading(true); setError('')
    try {
      const payload = {
        name:            form.name,
        room_type:       form.room_type,
        size_category:   form.size_category,
        pet_type:        form.pet_type,
        price_per_night: parseFloat(form.price_per_night),
        capacity:        parseInt(form.capacity) || 1,
        notes:           form.notes || null,
      }
      if (room) {
        await updateBoardingRoom(room.id, payload)
      } else {
        await createBoardingRoom(payload)
      }
      onSuccess(); onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving room')
    }
    setLoading(false)
  }

  const sz = SIZE_COLORS[form.size_category] || SIZE_COLORS.Medium

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <BedDouble size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{room ? 'Edit Room' : 'Add New Room'}</h2>
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
          {/* Room Name */}
          <div>
            <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">Room / Kennel Name</label>
            <input className="input-field" placeholder="e.g. Kennel A1, Suite S1" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* Type + Pet Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">Room Type</label>
              <select className="input-field" value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })}>
                {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">For</label>
              <select className="input-field" value={form.pet_type} onChange={e => setForm({ ...form, pet_type: e.target.value })}>
                {PET_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Size Category */}
          <div>
            <label className="block text-[0.8rem] font-500 text-gray-700 mb-2">Pet Size</label>
            <div className="grid grid-cols-4 gap-2">
              {SIZE_CATS.map(s => {
                const c = SIZE_COLORS[s]
                const active = form.size_category === s
                return (
                  <button key={s} type="button"
                    onClick={() => setForm({ ...form, size_category: s })}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all font-700 text-xs"
                    style={{
                      background:   active ? c.bg : 'white',
                      borderColor:  active ? c.color : '#e5e7eb',
                      color:        active ? c.color : '#9ca3af',
                    }}
                  >
                    <span className="text-lg">{c.emoji}</span>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price + Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">Price / Night ({currencySymbol})</label>
              <div className="form-group">
                <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
                <input className="input-field pl-8" type="number" placeholder="0"
                  value={form.price_per_night} onChange={e => setForm({ ...form, price_per_night: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">Capacity (pets)</label>
              <input className="input-field" type="number" min={1} placeholder="1"
                value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[0.8rem] font-500 text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="input-field" rows={2} placeholder="e.g. Has AC, near entrance..."
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Preview badge */}
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: sz.bg }}>
            <span className="text-2xl">{sz.emoji}</span>
            <div>
              <p className="font-700 text-sm" style={{ color: sz.color }}>{form.name || 'Room Name'}</p>
              <p className="text-xs text-gray-500">{form.room_type} · {form.size_category} · {form.price_per_night ? `${currencySymbol}${form.price_per_night}/night` : 'No price set'}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Saving...' : room ? 'Update Room' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
