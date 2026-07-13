'use client'

import { useState } from 'react'
import { X, User, ShieldCheck } from 'lucide-react'
import { updateClient } from '@/lib/actions'

interface Props {
  client: {
    id: string
    name: string
    whatsapp_number?: string | null
    email?: string | null
    address?: string | null
    total_spend?: number | null
    consent_given?: boolean | null
    marketing_opt_in?: boolean | null
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
  const [consentGiven, setConsentGiven] = useState(client.consent_given || false)
  const [marketingOptIn, setMarketingOptIn] = useState(client.marketing_opt_in || false)
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
        consent_given: consentGiven,
        marketing_opt_in: marketingOptIn,
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

          {/* ─── GDPR / DPDP Consent Section ─────────────────────────────────── */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={15} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#15803d' }}>Privacy Consent</span>
            </div>

            {/* Consent checkbox — REQUIRED */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="consent-checkbox"
                type="checkbox"
                checked={consentGiven}
                onChange={e => setConsentGiven(e.target.checked)}
                className="mt-0.5 accent-green-600"
                style={{ width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.5 }}>
                <strong>Client has verbally consented</strong> to their name, phone, and pet data
                being stored for appointment management and service history.{' '}
                <span style={{ color: '#dc2626' }}>*</span>
              </span>
            </label>

            {/* Marketing opt-in — OPTIONAL */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="marketing-checkbox"
                type="checkbox"
                checked={marketingOptIn}
                onChange={e => setMarketingOptIn(e.target.checked)}
                className="mt-0.5 accent-green-600"
                style={{ width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.5 }}>
                Client also consents to receive <strong>promotional messages</strong> and
                offers via WhatsApp. <span style={{ color: '#6b7280' }}>(Optional)</span>
              </span>
            </label>

            <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
              Consent recorded as: <em>manual (walk-in)</em> — compliant with DPDP Act, PDPL &amp; CCPA.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn-sage flex-1"
              disabled={loading || !consentGiven}
              style={{ opacity: !consentGiven ? 0.5 : 1 }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
