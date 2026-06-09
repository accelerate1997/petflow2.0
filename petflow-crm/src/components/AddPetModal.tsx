'use client'

import { useState, useEffect, useRef } from 'react'
import { X, PawPrint, Upload, Image as ImageIcon } from 'lucide-react'
import type { Client } from '@/types'
import { getClients, createPet, updatePet, getPresignedUploadUrl } from '@/lib/actions'

interface Props {
  onClose: () => void
  onSuccess: () => void
  preselectedOwnerId?: string
  existingPet?: any
}

export default function AddPetModal({ onClose, onSuccess, preselectedOwnerId, existingPet }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    pet_name: existingPet?.pet_name || '',
    species: existingPet?.species || 'dog',
    breed: existingPet?.breed || '',
    weight: existingPet?.weight ? String(existingPet.weight) : '',
    temperament_notes: existingPet?.temperament_notes || '',
    medical_alerts: existingPet?.medical_alerts || '',
    owner_id: existingPet?.owner_id || preselectedOwnerId || '',
    photo_url: existingPet?.photo || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getClients().then((records) => {
      setClients(records as unknown as Client[])
    }).catch(err => console.error('Error fetching clients:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pet_name.trim()) { setError('Pet name is required'); return }
    if (!form.owner_id) { setError('Please select an owner'); return }
    setLoading(true)
    setError('')

    try {
      let finalPhotoUrl = form.photo_url

      // If a new photo was selected, upload it directly to R2
      if (imageFile) {
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(imageFile.name, imageFile.type, 'pets')
        
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': imageFile.type },
          body: imageFile
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload pet photo to Cloudflare R2.')
        }
        finalPhotoUrl = publicUrl
      }

      const payload = {
        pet_name: form.pet_name.trim(),
        species: form.species,
        breed: form.breed || '',
        weight: parseFloat(form.weight || '0'),
        temperament_notes: form.temperament_notes || '',
        medical_alerts: form.medical_alerts || '',
        owner_id: form.owner_id,
        photo: finalPhotoUrl || '',
      }
      
      if (existingPet) {
        await updatePet(existingPet.id, payload)
      } else {
        await createPet(payload)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving pet')
    }
    setLoading(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        // Get local base64 preview for instant UI loading
        const base64Str = canvas.toDataURL('image/webp', 0.8)
        setForm(prev => ({ ...prev, photo_url: base64Str }))

        // Convert the resized canvas to a Blob and store as File for uploading
        canvas.toBlob((blob) => {
          if (blob) {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'photo'
            const compressedFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' })
            setImageFile(compressedFile)
          }
        }, 'image/webp', 0.8)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const temperamentOptions = ['Friendly', 'Calm', 'Nervous', 'Aggressive', 'Biter', 'Senior']
  const medicalOptions = ['Skin Allergy', 'Food Allergy', 'Heart Condition', 'Seizures', 'Arthritis', 'Blind/Deaf']

  const toggleTag = (field: 'temperament_notes' | 'medical_alerts', opt: string) => {
    const current = form[field].split(',').map((s: string) => s.trim()).filter(Boolean)
    if (current.includes(opt)) {
      setForm({ ...form, [field]: current.filter((t: string) => t !== opt).join(', ') })
    } else {
      setForm({ ...form, [field]: [...current, opt].join(', ') })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}>
              <PawPrint size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{existingPet ? 'Edit Pet' : 'Add New Pet'}</h2>
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
              Pet Photo
            </label>
            <div className="flex items-center gap-3">
              {form.photo_url ? (
                <div 
                  style={{ width: 48, height: 48, borderRadius: 8, background: `url(${form.photo_url}) center/cover no-repeat` }}
                />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={20} color="#9ca3af" />
                </div>
              )}
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[var(--sage-muted)] file:text-[var(--sage-dark)] hover:file:bg-[var(--sage-light)] cursor-pointer"
                />
              </div>
              {form.photo_url && (
                <button type="button" onClick={() => setForm({ ...form, photo_url: '' })} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

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
                  onClick={() => toggleTag('temperament_notes', opt)}
                  style={{
                    padding: '0.3rem 0.875rem',
                    borderRadius: '99px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: form.temperament_notes.includes(opt) ? '1.5px solid var(--sage)' : '1.5px solid #e5e7eb',
                    background: form.temperament_notes.includes(opt) ? 'var(--sage-muted)' : 'white',
                    color: form.temperament_notes.includes(opt) ? 'var(--sage-dark)' : '#6b7280',
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
              Medical Alerts (Comma separated)
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              {medicalOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleTag('medical_alerts', opt)}
                  style={{
                    padding: '0.3rem 0.875rem',
                    borderRadius: '99px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: form.medical_alerts.includes(opt) ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                    background: form.medical_alerts.includes(opt) ? '#fef2f2' : 'white',
                    color: form.medical_alerts.includes(opt) ? '#b91c1c' : '#6b7280',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input className="input-field" placeholder="Or type custom alerts... e.g. Allergic to chicken" value={form.medical_alerts} onChange={e => setForm({ ...form, medical_alerts: e.target.value })} />
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
              {loading ? 'Saving...' : (existingPet ? 'Update Pet' : 'Add Pet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
