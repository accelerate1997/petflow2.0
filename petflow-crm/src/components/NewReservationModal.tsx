'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Search, IndianRupee, Moon, Phone } from 'lucide-react'
import type { BoardingRoom, Pet, Client } from '@/types'
import { getClients, getPetsByOwner, createBoardingReservation } from '@/lib/actions'
import { getLocalDateString, addDays } from '@/lib/dateUtils'

interface Props {
  rooms: BoardingRoom[]
  defaultRoomId?: string
  defaultCheckInDate?: string
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

function calcNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

export default function NewReservationModal({ rooms, defaultRoomId, defaultCheckInDate, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [search, setSearch]               = useState('')
  const [clients, setClients]             = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [pets, setPets]                   = useState<Pet[]>([])
  const [selectedPet, setSelectedPet]     = useState<Pet | null>(null)
  const [petsLoading, setPetsLoading]     = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  const today = getLocalDateString()
  const tomorrow = getLocalDateString(addDays(new Date(), 1))

  const [form, setForm] = useState({
    room_id:          defaultRoomId || '',
    check_in_date:    defaultCheckInDate || today,
    check_out_date:   defaultCheckInDate 
      ? getLocalDateString(addDays(new Date(defaultCheckInDate), 1))
      : tomorrow,
    special_notes:    '',
    feeding_notes:    '',
    medication_notes: '',
    emergency_contact: '',
  })

  // search clients
  useEffect(() => {
    if (search.length > 1) {
      getClients(search).then(r => setClients(r as any)).catch(console.error)
    } else {
      setClients([])
    }
  }, [search])

  const selectedRoom = rooms.find(r => r.id === form.room_id)
  const nights = calcNights(form.check_in_date, form.check_out_date)
  const totalAmount = (selectedRoom?.price_per_night || 0) * nights

  // Filter only available rooms (no conflicting active reservation)
  const availableRooms = rooms.filter(r => {
    if (r.status === 'Maintenance') return false
    // Check local reservations for overlap
    const hasConflict = (r.reservations || []).some(res => {
      if (['Cancelled', 'CheckedOut'].includes(res.status)) return false
      return res.check_in_date < form.check_out_date && res.check_out_date > form.check_in_date
    })
    return !hasConflict
  })

  const selectClient = async (c: Client) => {
    setSelectedClient(c)
    setClients([])
    setSearch('')
    setPetsLoading(true)
    try {
      const petList = await getPetsByOwner(c.id)
      setPets(petList)
    } catch (err) {
      console.error('Error fetching pets:', err)
      setPets([])
    }
    setPetsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPet)   { setError('Please select a pet'); return }
    if (!form.room_id)  { setError('Please select a room'); return }
    if (nights <= 0)    { setError('Check-out must be after check-in'); return }

    setLoading(true); setError('')
    try {
      await createBoardingReservation({
        room_id:          form.room_id,
        pet_id:           selectedPet.id,
        check_in_date:    form.check_in_date,
        check_out_date:   form.check_out_date,
        total_nights:     nights,
        total_amount:     totalAmount,
        special_notes:    form.special_notes    || null,
        feeding_notes:    form.feeding_notes    || null,
        medication_notes: form.medication_notes || null,
        emergency_contact: form.emergency_contact || null,
      })
      onSuccess(); onClose()
    } catch (err: any) {
      setError(err.message || 'Error creating reservation')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <Calendar size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>New Boarding Reservation</h2>
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

          {/* ── Client Search ── */}
          {!selectedClient ? (
            <div className="relative">
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Search Pet Parent</label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-xl bg-gray-50 border-gray-100">
                <Search size={16} className="text-gray-400" />
                <input className="w-full outline-none text-sm bg-transparent" placeholder="Type name or phone..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {clients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {clients.map(c => (
                    <button key={c.id} type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                      onClick={() => selectClient(c)}>
                      <span className="font-600">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.whatsapp_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--sage-muted)', border: '1.5px solid rgba(137,168,148,0.2)' }}>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-lg bg-white w-9 h-9 text-xs font-bold shadow-sm uppercase" style={{ color: 'var(--sage-dark)' }}>
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-700">{selectedClient.name}</p>
                  <p className="text-[0.65rem] text-gray-500">{selectedClient.whatsapp_number}</p>
                </div>
              </div>
              <button type="button"
                className="text-xs font-700 hover:underline bg-white px-3 py-1 rounded-full shadow-sm"
                style={{ color: 'var(--sage-dark)' }}
                onClick={() => { setSelectedClient(null); setSelectedPet(null); setPets([]) }}>
                Change
              </button>
            </div>
          )}

          {/* ── Pet Selection ── */}
          {selectedClient && (
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Select Pet</label>
              {petsLoading ? (
                <div className="input-field flex items-center gap-2 text-gray-400 text-sm">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-300 border-t-sage rounded-full" />
                  Loading pets...
                </div>
              ) : (
                <select className="input-field"
                  value={selectedPet?.id || ''}
                  onChange={e => setSelectedPet(pets.find(p => p.id === e.target.value) || null)}>
                  <option value="">
                    {pets.length === 0 ? '⚠️ No pets found for this client' : 'Select pet...'}
                  </option>
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.pet_name} ({p.species}){p.weight ? ` · ${p.weight}kg` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Dates ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Check-in Date</label>
              <input className="input-field" type="date" value={form.check_in_date}
                onChange={e => setForm({ ...form, check_in_date: e.target.value })} />
            </div>
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Check-out Date</label>
              <input className="input-field" type="date" value={form.check_out_date}
                onChange={e => setForm({ ...form, check_out_date: e.target.value })} />
            </div>
          </div>

          {/* ── Room Selection ── */}
          <div>
            <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-2 block">
              Available Rooms ({availableRooms.length} of {rooms.length} available)
            </label>
            {availableRooms.length === 0 ? (
              <div className="rounded-xl p-4 text-center text-sm text-gray-400 border-2 border-dashed">
                No rooms available for selected dates
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableRooms.map(r => {
                  const active = form.room_id === r.id
                  const sizeEmojis: Record<string, string> = { Small: '🐩', Medium: '🐕', Large: '🐕‍🦺', Cat: '🐱' }
                  const typeColors: Record<string, string> = { Standard: '#6b7280', Deluxe: '#d97706', Suite: '#7c3aed' }
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
                        <span className="text-base">{sizeEmojis[r.size_category] || '🐾'}</span>
                      </div>
                      <p className="text-[0.65rem] font-600" style={{ color: typeColors[r.room_type] || '#6b7280' }}>{r.room_type} · {r.size_category}</p>
                      <p className="text-[0.7rem] font-800 mt-1" style={{ color: 'var(--sage-dark)' }}>{currencySymbol}{r.price_per_night}/night</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Price Summary ── */}
          {selectedRoom && nights > 0 && (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--sage-muted)' }}>
              <div className="flex items-center gap-2">
                <Moon size={16} style={{ color: 'var(--sage-dark)' }} />
                <span className="text-sm font-600">{nights} night{nights > 1 ? 's' : ''} × {currencySymbol}{selectedRoom.price_per_night}</span>
              </div>
              <span className="font-800 text-lg" style={{ color: 'var(--sage-dark)' }}>{currencySymbol}{totalAmount.toLocaleString()}</span>
            </div>
          )}

          {/* ── Care Instructions (collapsible section) ── */}
          <details className="group">
            <summary className="text-[0.75rem] font-700 text-gray-500 cursor-pointer flex items-center gap-1 list-none">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Care Instructions (optional)
            </summary>
            <div className="flex flex-col gap-3 mt-3 pl-4 border-l-2" style={{ borderColor: 'var(--sage-muted)' }}>
              <div>
                <label className="block text-[0.75rem] font-600 text-gray-600 mb-1">🍖 Feeding Schedule / Diet</label>
                <textarea className="input-field" rows={2} placeholder="e.g. 2x daily, Royal Canin dry food 100g each..."
                  value={form.feeding_notes} onChange={e => setForm({ ...form, feeding_notes: e.target.value })} />
              </div>
              <div>
                <label className="block text-[0.75rem] font-600 text-gray-600 mb-1">💊 Medication</label>
                <textarea className="input-field" rows={2} placeholder="e.g. 1 tablet of XYZ every morning with food..."
                  value={form.medication_notes} onChange={e => setForm({ ...form, medication_notes: e.target.value })} />
              </div>
              <div>
                <label className="block text-[0.75rem] font-600 text-gray-600 mb-1">📝 Special Instructions</label>
                <textarea className="input-field" rows={2} placeholder="Allergies, behavioral notes, favorite toy..."
                  value={form.special_notes} onChange={e => setForm({ ...form, special_notes: e.target.value })} />
              </div>
              <div>
                <label className="block text-[0.75rem] font-600 text-gray-600 mb-1 flex items-center gap-1">
                  <Phone size={12} /> Emergency Contact
                </label>
                <input className="input-field" placeholder="Name & phone number"
                  value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
              </div>
            </div>
          </details>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Booking...' : 'Confirm Boarding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
