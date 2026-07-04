'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Search, Clock, Scissors, Plus, Trash2, Dog, Truck } from 'lucide-react'
import { getServices, getClients, createAppointment, getStaff, getSettings, getVans } from '@/lib/actions'
import { getLocalDateString } from '@/lib/dateUtils'
import type { Client, Pet, Service, Staff, Van } from '@/types'

interface Props {
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

// ── Helper: derive pet size category from weight ─────────────────────────────
type PetSize = 'small' | 'medium' | 'large' | null

function getPetSize(weight: number | null | undefined): PetSize {
  if (weight == null) return null
  if (weight < 10)  return 'small'
  if (weight <= 25) return 'medium'
  return 'large'
}

const SIZE_BADGE: Record<NonNullable<PetSize>, { label: string; emoji: string; bg: string; color: string }> = {
  small:  { label: 'Small',  emoji: '🐩',    bg: '#f0fdf4', color: '#16a34a' },
  medium: { label: 'Medium', emoji: '🐕',    bg: '#fffbeb', color: '#d97706' },
  large:  { label: 'Large',  emoji: '🐕‍🦺', bg: '#fef2f2', color: '#dc2626' },
}

// ── Helper: pick correct price from a service given pet size ─────────────────
function getPriceForSize(service: Service, size: PetSize): number {
  if (size === 'small'  && service.price_small  != null) return service.price_small
  if (size === 'medium' && service.price_medium != null) return service.price_medium
  if (size === 'large'  && service.price_large  != null) return service.price_large
  return service.price // fallback to base price
}

// ── Helper: check if service has tiered pricing ───────────────────────────────
function hasTieredPricing(s: Service) {
  return s.price_small != null || s.price_medium != null || s.price_large != null
}

export default function BookAppointmentModal({ onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [clients, setClients]       = useState<Client[]>([])
  const [pets, setPets]             = useState<Pet[]>([])
  const [services, setServices]     = useState<Service[]>([])
  const [staffList, setStaffList]   = useState<Staff[]>([])
  const [search, setSearch]         = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedPet, setSelectedPet]       = useState<Pet | null>(null)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [mobileEnabled, setMobileEnabled]   = useState(false)
  const [vans, setVans]                     = useState<Van[]>([])

  const [form, setForm] = useState({
    pet_id:           '',
    appointment_date: getLocalDateString(),
    appointment_time: '10:00',
    price:            0,
    notes:            '',
    payment_status:   'Pending',
    groomer_id:       '',
    van_id:           '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const petSize: PetSize = getPetSize(selectedPet?.weight)

  // Load services & staff once
  useEffect(() => {
    getServices().then(r  => setServices(r as unknown as Service[]))
      .catch(err => console.error(err))
    getStaff(true).then(d => setStaffList(d as any))
      .catch(err => console.error(err))
    getSettings().then(s => {
      if (s?.mobile_enabled) {
        setMobileEnabled(true)
        getVans().then(v => setVans(v as any)).catch(console.error)
      }
    }).catch(console.error)
  }, [])

  // Client search
  useEffect(() => {
    if (search.length > 1) {
      getClients(search).then(r => setClients(r as any)).catch(console.error)
    } else {
      setClients([])
    }
  }, [search])

  const selectClient = (client: Client) => {
    setSelectedClient(client)
    setPets(client.pets || [])
    setSelectedPet(null)
    setClients([])
    setSearch('')
    setForm(f => ({ ...f, pet_id: '' }))
  }

  const selectPet = (petId: string) => {
    const pet = pets.find(p => p.id === petId) || null
    setSelectedPet(pet)
    setForm(f => ({ ...f, pet_id: petId }))

    // Recalculate total with new pet size
    const newSize = getPetSize(pet?.weight)
    const newTotal = selectedServices.reduce((sum, s) => sum + getPriceForSize(s, newSize), 0)
    setForm(f => ({ ...f, pet_id: petId, price: newTotal }))
  }

  const addService = (serviceId: string) => {
    const s = services.find(x => x.id === serviceId)
    if (s && !selectedServices.find(x => x.id === serviceId)) {
      const newList = [...selectedServices, s]
      setSelectedServices(newList)
      setForm(f => ({ ...f, price: newList.reduce((sum, x) => sum + getPriceForSize(x, petSize), 0) }))
    }
  }

  const removeService = (id: string) => {
    const newList = selectedServices.filter(s => s.id !== id)
    setSelectedServices(newList)
    setForm(f => ({ ...f, price: newList.reduce((sum, x) => sum + getPriceForSize(x, petSize), 0) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pet_id) { setError('Please select a pet'); return }
    if (selectedServices.length === 0) { setError('Please select at least one service'); return }

    setLoading(true)
    setError('')
    try {
      const serviceNames = selectedServices.map(s => s.service_name).join(' + ')
      await createAppointment({
        pet_id:           form.pet_id,
        service_type:     serviceNames,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        price:            form.price,
        notes:            form.notes || null,
        status:           'Booked',
        payment_status:   form.payment_status,
        groomer_id:       form.groomer_id || null,
        van_id:           form.van_id || null,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error booking appointment')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <Calendar size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>New Booking</h2>
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
          {/* Client Selection */}
          {!selectedClient ? (
            <div className="relative">
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Search Pet Parent</label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-xl bg-gray-50 border-gray-100">
                <Search size={16} className="text-gray-400" />
                <input
                  className="w-full outline-none text-sm bg-transparent"
                  placeholder="Type name or phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {clients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                      onClick={() => selectClient(c)}
                    >
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
                <div className="flex items-center justify-center rounded-lg bg-white w-9 h-9 text-xs font-bold color-sage-dark shadow-sm uppercase">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-700">{selectedClient.name}</p>
                  <p className="text-[0.65rem] text-gray-500 font-500">{selectedClient.whatsapp_number}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-700 color-sage-dark hover:underline bg-white px-3 py-1 rounded-full shadow-sm"
                onClick={() => {
                  setSelectedClient(null)
                  setSelectedPet(null)
                  setPets([])
                  setSelectedServices([])
                  setForm(f => ({ ...f, pet_id: '', price: 0 }))
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Pet Selection */}
          {selectedClient && (
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Select Pet</label>
              <div className="flex items-center gap-2">
                <select
                  className="input-field flex-1"
                  value={form.pet_id}
                  onChange={e => selectPet(e.target.value)}
                >
                  <option value="">{pets.length === 0 ? 'No pets found' : 'Select pet...'}</option>
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.pet_name} ({p.species}){p.weight ? ` · ${p.weight}kg` : ''}
                    </option>
                  ))}
                </select>

                {/* Size badge */}
                {selectedPet && petSize && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0 font-700 text-xs"
                    style={{ background: SIZE_BADGE[petSize].bg, color: SIZE_BADGE[petSize].color }}
                  >
                    <span>{SIZE_BADGE[petSize].emoji}</span>
                    {SIZE_BADGE[petSize].label}
                  </div>
                )}
                {selectedPet && !selectedPet.weight && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0 font-600 text-xs"
                    style={{ background: '#f3f4f6', color: '#6b7280' }}
                    title="Add pet weight to enable size-based pricing"
                  >
                    ⚖️ No weight
                  </div>
                )}
              </div>
              {selectedPet && !selectedPet.weight && (
                <p className="text-[0.7rem] text-amber-600 mt-1">
                  ⚠️ Add pet weight in pet profile to enable auto size-based pricing.
                </p>
              )}
            </div>
          )}

          {/* Multiple Services Selector */}
          <div className="card p-3 border-dashed border-2 border-gray-200">
            <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-2 block">Add Services</label>
            <div className="flex gap-2 mb-3">
              <select
                className="input-field flex-1 text-sm"
                onChange={e => addService(e.target.value)}
                value=""
              >
                <option value="" disabled>Choose a service...</option>
                {services.map(s => {
                  const displayPrice = getPriceForSize(s, petSize)
                  const tierLabel = hasTieredPricing(s) && petSize
                    ? ` (${SIZE_BADGE[petSize]?.label ?? ''} · ${currencySymbol}${displayPrice})`
                    : ` (${currencySymbol}${displayPrice})`
                  return (
                    <option key={s.id} value={s.id} disabled={selectedServices.some(x => x.id === s.id)}>
                      {s.service_name}{tierLabel}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedServices.length === 0 ? (
                <p className="text-[0.75rem] text-gray-400 italic">No services selected yet</p>
              ) : (
                selectedServices.map(s => {
                  const p = getPriceForSize(s, petSize)
                  const tiered = hasTieredPricing(s) && petSize
                  return (
                    <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <span className="text-[0.75rem] font-700">{s.service_name}</span>
                      {tiered && (
                        <span
                          className="text-[0.6rem] font-700 px-1.5 py-0.5 rounded-full"
                          style={{
                            background: SIZE_BADGE[petSize!].bg,
                            color: SIZE_BADGE[petSize!].color
                          }}
                        >
                          {SIZE_BADGE[petSize!].emoji} {currencySymbol}{p}
                        </span>
                      )}
                      {!tiered && (
                        <span className="text-[0.6rem] text-gray-400">{currencySymbol}{p}</span>
                      )}
                      <button type="button" onClick={() => removeService(s.id)} className="text-red-400 hover:text-red-600 ml-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Total Price ({currencySymbol})</label>
              <div className="form-group">
                <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
                <input
                  className="input-field pl-8 font-700 text-sage-dark"
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Groomer</label>
              <div className="form-group">
                <Scissors size={14} className="text-gray-400" />
                <select
                  className="input-field pl-8"
                  value={form.groomer_id}
                  onChange={e => setForm({ ...form, groomer_id: e.target.value })}
                >
                  <option value="">Auto-assign</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {mobileEnabled && (
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Assign Grooming Van</label>
              <div className="form-group">
                <Truck size={14} className="text-gray-400" />
                <select
                  className="input-field pl-8"
                  value={form.van_id}
                  onChange={e => setForm({ ...form, van_id: e.target.value })}
                >
                  <option value="">Not Assigned (Store / In-Shop)</option>
                  {vans.filter(v => v.status === 'Active').map(v => (
                    <option key={v.id} value={v.id}>{v.name} {v.plate_number ? `(${v.plate_number})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Date</label>
              <div className="form-group">
                <input
                  className="input-field"
                  type="date"
                  value={form.appointment_date}
                  onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-wider mb-1.5 block">Time</label>
              <div className="form-group">
                <input
                  className="input-field"
                  type="time"
                  value={form.appointment_time}
                  onChange={e => setForm({ ...form, appointment_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button type="button" className="btn-outline flex-1 py-3" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1 py-3 font-700" disabled={loading}>
              {loading ? 'Booking...' : 'Confirm Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
