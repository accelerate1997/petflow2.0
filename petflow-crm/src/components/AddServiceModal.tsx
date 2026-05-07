'use client'

import { useState } from 'react'
import { X, Sparkles, Image as ImageIcon, IndianRupee, Tag } from 'lucide-react'
import { pb } from '@/lib/pocketbase'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function AddServiceModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    service_name: '',
    pet_type: 'all' as 'dog' | 'cat' | 'other' | 'all',
    description: '',
    price: '',
    thumbnail: '✂️', // Default emoji
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_name) { setError('Service name is required'); return }
    if (!form.price) { setError('Price is required'); return }

    setLoading(true)
    setError('')

    try {
      await pb.collection('services').create({
        service_name: form.service_name,
        pet_type: form.pet_type,
        description: form.description || null,
        price: parseFloat(form.price),
        thumbnail: form.thumbnail,
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
      <div className="modal-box" onClick={e => e.stopPropagation()}>
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
                 style={{ width: 64, height: 64, background: 'var(--bg)', border: '2px dashed #e5e7eb' }}
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
                Base Price (₹)
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
