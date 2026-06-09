'use client'

import { useState } from 'react'
import { X, Tag, ToggleLeft, ToggleRight } from 'lucide-react'
import { createService } from '@/lib/actions'

interface Props {
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

const SIZE_TIERS = [
  { key: 'price_small',  label: 'Small',  emoji: '🐩', hint: '< 10 kg',  color: '#22c55e' },
  { key: 'price_medium', label: 'Medium', emoji: '🐕', hint: '10–25 kg', color: '#f59e0b' },
  { key: 'price_large',  label: 'Large',  emoji: '🐕‍🦺', hint: '> 25 kg', color: '#ef4444' },
] as const

export default function AddServiceModal({ onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [useTiered, setUseTiered] = useState(false)
  const [form, setForm] = useState({
    service_name: '',
    pet_type: 'all' as 'dog' | 'cat' | 'other' | 'all',
    description: '',
    // Flat pricing
    price: '',
    // Tiered pricing
    price_small: '',
    price_medium: '',
    price_large: '',
    thumbnail: '✂️',
    estimated_duration: '60',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_name) { setError('Service name is required'); return }

    if (useTiered) {
      if (!form.price_small && !form.price_medium && !form.price_large) {
        setError('Please enter at least one size-based price'); return
      }
    } else {
      if (!form.price) { setError('Price is required'); return }
    }

    setLoading(true)
    setError('')

    try {
      // Base price = smallest non-zero tier (for backward compat) or flat price
      let basePrice = parseFloat(form.price) || 0
      let price_small: number | null = null
      let price_medium: number | null = null
      let price_large: number | null = null

      if (useTiered) {
        price_small  = form.price_small  ? parseFloat(form.price_small)  : null
        price_medium = form.price_medium ? parseFloat(form.price_medium) : null
        price_large  = form.price_large  ? parseFloat(form.price_large)  : null
        // base price = minimum non-null tier
        const nonNull = [price_small, price_medium, price_large].filter(v => v !== null) as number[]
        basePrice = nonNull.length > 0 ? Math.min(...nonNull) : 0
      }

      await createService({
        service_name: form.service_name,
        pet_type: form.pet_type,
        description: form.description || null,
        price: basePrice,
        price_small,
        price_medium,
        price_large,
        thumbnail: form.thumbnail,
        estimated_duration: parseInt(form.estimated_duration) || 60,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving service')
    }
    setLoading(false)
  }

  const emojiOptions = ['✂️', '🧼', '💅', '🐶', '🐱', '🦷', '🛁', '🧸', '🚿', '🧺']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <Tag size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Add New Service</h2>
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
          {/* Thumbnail / Emoji Picker */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
              Service Thumbnail / Icon
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex items-center justify-center rounded-2xl text-2xl"
                style={{ width: 64, height: 64, background: 'var(--bg)', border: '2px dashed #e5e7eb', flexShrink: 0 }}
              >
                {form.thumbnail}
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {emojiOptions.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, thumbnail: emoji })}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-50 transition-colors ${form.thumbnail === emoji ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'border'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <input
              className="input-field"
              placeholder="Or paste an image URL..."
              value={form.thumbnail && !emojiOptions.includes(form.thumbnail) ? form.thumbnail : ''}
              onChange={e => setForm({ ...form, thumbnail: e.target.value })}
              style={{ fontSize: '0.75rem' }}
            />
          </div>

          {/* Service Name */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Service Name
            </label>
            <input
              className="input-field"
              placeholder="e.g. Deluxe Spa Grooming"
              value={form.service_name}
              onChange={e => setForm({ ...form, service_name: e.target.value })}
            />
          </div>

          {/* Pet Type & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Pet Type
              </label>
              <select
                className="input-field"
                value={form.pet_type}
                onChange={e => setForm({ ...form, pet_type: e.target.value as any })}
              >
                <option value="all">All Pets</option>
                <option value="dog">Dogs Only</option>
                <option value="cat">Cats Only</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Duration (mins)
              </label>
              <input
                className="input-field"
                type="number"
                placeholder="60"
                value={form.estimated_duration}
                onChange={e => setForm({ ...form, estimated_duration: e.target.value })}
              />
            </div>
          </div>

          {/* Pricing Mode Toggle */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--sage-muted)', border: '1.5px solid rgba(137,168,148,0.25)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>Pricing Mode</p>
                <p style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                  {useTiered ? 'Different price per pet size' : 'Same price for all sizes'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseTiered(!useTiered)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-700 transition-all"
                style={{
                  background: useTiered ? 'var(--sage-dark)' : '#e5e7eb',
                  color: useTiered ? 'white' : '#6b7280',
                }}
              >
                {useTiered ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {useTiered ? 'Size-Based' : 'Flat Price'}
              </button>
            </div>

            {!useTiered ? (
              /* ── Flat price ── */
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Price ({currencySymbol})
                </label>
                <div className="form-group" style={{ background: 'white' }}>
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
            ) : (
              /* ── Tiered prices ── */
              <div className="flex flex-col gap-2">
                {SIZE_TIERS.map(tier => (
                  <div key={tier.key} className="flex items-center gap-3">
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-shrink-0"
                      style={{ background: 'white', border: `1.5px solid ${tier.color}22`, minWidth: 120 }}
                    >
                      <span style={{ fontSize: '1rem' }}>{tier.emoji}</span>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: tier.color }}>{tier.label}</p>
                        <p style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{tier.hint}</p>
                      </div>
                    </div>
                    <div className="form-group flex-1" style={{ background: 'white' }}>
                      <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
                      <input
                        className="input-field pl-7"
                        type="number"
                        placeholder="Leave blank if not applicable"
                        value={form[tier.key]}
                        onChange={e => setForm({ ...form, [tier.key]: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>
                  💡 Leave a size blank if you don't offer this service for that size.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Description
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="What's included in this service?"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Adding...' : 'Save Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
