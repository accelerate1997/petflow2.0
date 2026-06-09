'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Scissors, FileText } from 'lucide-react'
import { updateAppointment, getStaff } from '@/lib/actions'
import type { Appointment, Staff } from '@/types'

interface Props {
  appointment: Appointment
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

export default function RescheduleModal({ appointment, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [form, setForm] = useState({
    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time.slice(0, 5),
    notes: appointment.notes || '',
    groomer_id: appointment.groomer_id || '',
    price: appointment.price?.toString() || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getStaff(true).then(data => setStaffList(data as any)).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.appointment_date) { setError('Date is required'); return }
    if (!form.appointment_time) { setError('Time is required'); return }

    setLoading(true)
    setError('')
    try {
      await updateAppointment(appointment.id, {
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        notes: form.notes || undefined,
        groomer_id: form.groomer_id || null,
        price: form.price ? parseFloat(form.price) : undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule')
    }
    setLoading(false)
  }

  const petName = (appointment as any).pets?.pet_name || (appointment as any).pet?.pet_name || 'Pet'
  const ownerName = (appointment as any).pets?.clients?.name || ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.1)' }}
            >
              <Calendar size={18} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Reschedule Appointment</h2>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                {petName}{ownerName ? ` · ${ownerName}` : ''} · {appointment.service_type}
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

        {/* Current schedule hint */}
        <div
          className="rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <Clock size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Current: <strong>{appointment.appointment_date}</strong> at <strong>{appointment.appointment_time.slice(0, 5)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* New Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                New Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div className="form-group">
                <Calendar size={14} className="text-gray-400" />
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
                New Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div className="form-group">
                <Clock size={14} className="text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="time"
                  value={form.appointment_time}
                  onChange={e => setForm({ ...form, appointment_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Groomer & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Groomer
              </label>
              <div className="form-group">
                <Scissors size={14} className="text-gray-400" />
                <select
                  className="input-field pl-8"
                  value={form.groomer_id}
                  onChange={e => setForm({ ...form, groomer_id: e.target.value })}
                >
                  <option value="">No groomer</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.role ? ` (${s.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Price ({currencySymbol})
              </label>
              <div className="form-group">
                <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
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

          {/* Notes */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Notes
            </label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
              <textarea
                className="input-field pl-8"
                rows={2}
                placeholder="Any special instructions..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 font-700 rounded-xl py-2.5 text-sm transition-all"
              disabled={loading}
              style={{ background: '#6366f1', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              <Calendar size={15} />
              {loading ? 'Saving...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
