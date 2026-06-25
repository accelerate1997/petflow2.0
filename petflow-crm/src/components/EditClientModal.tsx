'use client'

import { useState } from 'react'
import { X, User } from 'lucide-react'
import { updateClient } from '@/lib/actions'

interface Props {
  client: {
    id: string
    name: string
    whatsapp_number?: string | null
    email?: string | null
    address?: string | null
    total_spend?: number | null
  }
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

export default function EditClientModal({ client, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [form, setForm] = useState({
    name: client.name || '',
    whatsapp_number: client.whatsapp_number || '',
    email: client.email || '',
    address: client.address || '',
    total_spend: client.total_spend !== null && client.total_spend !== undefined ? client.total_spend.toString() : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      await updateClient(client.id, {
        name: form.name.trim(),
        whatsapp_number: form.whatsapp_number || null,
        email: form.email || null,
        address: form.address || null,
        total_spend: form.total_spend ? parseFloat(form.total_spend) : 0,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error updating client')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <User size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Edit Client Details</h2>
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
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Full Name *
            </label>
            <input className="input-field" placeholder="e.g. Sarah Mitchell" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                WhatsApp
              </label>
              <input className="input-field" placeholder="+91 98765 43210" value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Email
              </label>
              <input className="input-field" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Address
            </label>
            <input className="input-field" placeholder="Street, City" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Total Spend ({currencySymbol})
            </label>
            <input className="input-field" type="number" placeholder="0" value={form.total_spend} onChange={e => setForm({ ...form, total_spend: e.target.value })} />
          </div>

          <div className="flex gap-3 pt-2">
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
