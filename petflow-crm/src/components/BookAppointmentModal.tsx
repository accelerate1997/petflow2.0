'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Search, User, PawPrint, Clock, IndianRupee } from 'lucide-react'
import type { Client, Pet, Service } from '@/types'
import { getServices, getClients, createAppointment } from '@/lib/actions'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function BookAppointmentModal({ onClose, onSuccess }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [form, setForm] = useState({
    pet_id: '',
    service_type: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00',
    price: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getServices().then((records) => {
      setServices(records as unknown as Service[])
      if (records.length > 0) {
        setForm(f => ({ ...f, service_type: records[0].service_name, price: records[0].price.toString() }))
      }
    }).catch(err => console.error('Error fetching services:', err))
  }, [])

  useEffect(() => {
    if (search.length > 1) {
      getClients(search).then((result) => {
        setClients(result as any)
      }).catch(err => console.error('Error searching clients:', err))
    } else {
      setClients([])
    }
  }, [search])

  const selectClient = (client: Client) => {
    setSelectedClient(client)
    setPets((client as any).pets || [])
    setClients([])
    setSearch('')
  }

  const handleServiceChange = (name: string) => {
    const s = services.find(x => x.service_name === name)
    setForm({ ...form, service_type: name, price: s ? s.price.toString() : form.price })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pet_id) { setError('Please select a pet'); return }
    if (!form.service_type) { setError('Service type is required'); return }

    setLoading(true)
    setError('')

    try {
      await createAppointment({
        pet_id: form.pet_id,
        service_type: form.service_type,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        price: form.price ? parseFloat(form.price) : 0,
        notes: form.notes || null,
        status: 'Booked',
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
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <Calendar size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Book Appointment</h2>
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
          {/* Pet Parent Search */}
          {!selectedClient ? (
            <div className="relative">
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Search Pet Parent
              </label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-xl" style={{ border: '1.5px solid #e5e7eb' }}>
                <Search size={16} style={{ color: '#9ca3af' }} />
                <input
                  className="w-full outline-none text-sm"
                  placeholder="Type name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {clients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                      onClick={() => selectClient(c)}
                    >
                      <span className="font-500">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.whatsapp_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--sage-muted)', border: '1.5px solid rgba(137,168,148,0.2)' }}>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-lg bg-white w-8 h-8 text-xs font-bold color-sage-dark">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-600">{selectedClient.name}</p>
                  <p className="text-xs text-gray-500">Parent</p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-600 color-sage-dark hover:underline"
                onClick={() => { setSelectedClient(null); setPets([]); setForm({ ...form, pet_id: '' }) }}
              >
                Change
              </button>
            </div>
          )}

          {/* Pet Selection */}
          {selectedClient && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Select Pet
              </label>
              <select
                className="input-field"
                value={form.pet_id}
                onChange={e => setForm({ ...form, pet_id: e.target.value })}
              >
                <option value="">{pets.length === 0 ? 'No pets found' : 'Select pet...'}</option>
                {pets.map(p => (
                  <option key={p.id} value={p.id}>{p.pet_name} ({p.species})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Service
              </label>
              <select
                className="input-field"
                value={form.service_type}
                onChange={e => handleServiceChange(e.target.value)}
              >
                <option value="" disabled>Select service...</option>
                {services.map(s => <option key={s.id} value={s.service_name}>{s.service_name} ({s.pet_type})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Price (₹)
              </label>
              <div className="relative">
                <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="date"
                  value={form.appointment_date}
                  onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Time
              </label>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="time"
                  value={form.appointment_time}
                  onChange={e => setForm({ ...form, appointment_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Notes
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Any special instructions..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Booking...' : 'Confirm Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

