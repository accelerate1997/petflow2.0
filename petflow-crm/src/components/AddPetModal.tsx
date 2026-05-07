'use client'

import { useState, useEffect, useRef } from 'react'
import { X, PawPrint, Upload } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import type { Client } from '@/types'

interface Props {
  onClose: () => void
  onSuccess: () => void
  preselectedOwnerId?: string
}

export default function AddPetModal({ onClose, onSuccess, preselectedOwnerId }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState({
    pet_name: '',
    species: 'dog',
    breed: '',
    weight: '',
    temperament_notes: '',
    medical_alerts: '',
    owner_id: preselectedOwnerId || '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pb.collection('clients').getFullList({
      sort: 'name',
      fields: 'id,name'
    }).then((records) => {
      setClients(records as unknown as Client[])
    }).catch(err => console.error('Error fetching clients:', err))
  }, [])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pet_name.trim()) { setError('Pet name is required'); return }
    if (!form.owner_id) { setError('Please select an owner'); return }
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('pet_name', form.pet_name.trim())
      formData.append('species', form.species)
      formData.append('breed', form.breed || '')
      formData.append('weight', form.weight || '0')
      formData.append('temperament_notes', form.temperament_notes || '')
      formData.append('medical_alerts', form.medical_alerts || '')
      formData.append('owner_id', form.owner_id)
      
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      await pb.collection('pets').create(formData)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving pet')
    }
    setLoading(false)
  }


  const temperamentOptions = ['Friendly', 'Calm', 'Anxious', 'Aggressive']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <PawPrint size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Add New Pet</h2>
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

        {/* Photo Upload */}
        <div className="flex items-center gap-4 mb-5">
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '1rem', cursor: 'pointer',
              background: photoPreview ? `url(${photoPreview}) center/cover no-repeat` : 'var(--sage-muted)',
              border: '2px dashed var(--sage-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {!photoPreview && <Upload size={20} style={{ color: 'var(--sage)' }} />}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Pet Photo</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Click to upload (optional)</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Pet Name *
              </label>
              <input className="input-field" placeholder="e.g. Mango" value={form.pet_name} onChange={e => setForm({ ...form, pet_name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Species *
              </label>
              <select className="input-field" value={form.species} onChange={e => setForm({ ...form, species: e.target.value })}>
                <option value="dog">🐕 Dog</option>
                <option value="cat">🐈 Cat</option>
                <option value="other">🐾 Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Breed
              </label>
              <input className="input-field" placeholder="e.g. Golden Retriever" value={form.breed} onChange={e => setForm({ ...form, breed: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Weight (kg)
              </label>
              <input className="input-field" type="number" step="0.1" placeholder="e.g. 12.5" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
              Temperament
            </label>
            <div className="flex gap-2 flex-wrap">
              {temperamentOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm({ ...form, temperament_notes: form.temperament_notes === opt ? '' : opt })}
                  style={{
                    padding: '0.3rem 0.875rem',
                    borderRadius: '99px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: form.temperament_notes === opt ? '1.5px solid var(--sage)' : '1.5px solid #e5e7eb',
                    background: form.temperament_notes === opt ? 'var(--sage-muted)' : 'white',
                    color: form.temperament_notes === opt ? 'var(--sage-dark)' : '#6b7280',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Medical Alerts
            </label>
            <input className="input-field" placeholder="e.g. Allergic to flea medicine" value={form.medical_alerts} onChange={e => setForm({ ...form, medical_alerts: e.target.value })} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Owner *
            </label>
            <select className="input-field" value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
              <option value="">Select an owner...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
