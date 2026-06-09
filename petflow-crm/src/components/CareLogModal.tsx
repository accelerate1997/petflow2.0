'use client'

import { useState } from 'react'
import { X, AlertTriangle, RefreshCw, Upload, Image as ImageIcon, CheckCircle } from 'lucide-react'
import { getPresignedUploadUrl, addBoardingCareLog } from '@/lib/actions'
import type { BoardingReservation } from '@/types'

interface CareLogModalProps {
  reservation: BoardingReservation
  onClose: () => void
  onSuccess: () => void
}

type ActivityType = 'Feeding' | 'Medication' | 'Potty' | 'Mood' | 'General'

const CATEGORY_PRESETS: Record<ActivityType, string[]> = {
  Feeding: ['Eaten All', 'Eaten Half', 'Refused', 'Fed Custom Diet'],
  Medication: ['Administered', 'Refused', 'Partially Administered'],
  Potty: ['Pee & Poop', 'Pee Only', 'Poop Only', 'Normal Walk'],
  Mood: ['Happy & Playful', 'Calm & Relaxed', 'Anxious/Whining', 'Hyperactive'],
  General: ['Completed', 'Observed', 'Attention Required']
}

const CATEGORY_ICONS: Record<ActivityType, string> = {
  Feeding: '🍖',
  Medication: '💊',
  Potty: '🌳',
  Mood: '✨',
  General: '📋'
}

export default function CareLogModal({ reservation, onClose, onSuccess }: CareLogModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form fields
  const [category, setCategory] = useState<ActivityType>('Feeding')
  const [status, setStatus] = useState<string>('Eaten All')
  const [notes, setNotes] = useState<string>('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loggedBy, setLoggedBy] = useState<string>('Staff')
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true)

  // Handle category change
  const handleCategoryChange = (cat: ActivityType) => {
    setCategory(cat)
    // Default to the first preset of that category
    setStatus(CATEGORY_PRESETS[cat][0])
  }

  // Handle image upload to Cloudflare R2
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    setError(null)

    try {
      // 1. Request presigned upload URL
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
        file.name,
        file.type,
        'boarding'
      )

      // 2. Upload file directly to R2
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })

      if (!res.ok) {
        throw new Error('Failed to upload photo to storage.')
      }

      setPhotoUrl(publicUrl)
    } catch (err: any) {
      console.error('R2 upload error:', err)
      setError(err.message || 'Failed to upload photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status.trim()) {
      setError('Status is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await addBoardingCareLog({
        reservation_id: reservation.id,
        activity_type: category,
        status: status.trim(),
        notes: notes.trim() || null,
        photo_url: photoUrl,
        logged_by: loggedBy.trim() || 'Staff',
        send_whatsapp: sendWhatsApp
      })

      onSuccess()
    } catch (err: any) {
      console.error('Care log save error:', err)
      setError(err.message || 'An unexpected error occurred while saving care log.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-[500px] flex flex-col p-6 rounded-2xl relative bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📋 Log Guest Care</h2>
            <p className="text-xs text-gray-400">
              Record care event for <span className="font-semibold text-sage-dark">{reservation.pet?.pet_name}</span>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 flex-1 overflow-y-auto">
          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Category</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['Feeding', 'Medication', 'Potty', 'Mood', 'General'] as ActivityType[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 cursor-pointer ${
                    category === cat
                      ? 'bg-sage-muted text-sage-dark border-sage ring-2 ring-sage-muted/50'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick presets / pills */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Quick Status Presets</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PRESETS[category].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStatus(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    status === preset
                      ? 'bg-sage text-white border-sage'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Status text input */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status Description</label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
              placeholder="Enter status..."
              required
            />
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes / Description</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-field py-2"
              placeholder="e.g. Coco drank water well, did potty normal..."
            />
          </div>

          {/* Photo attachment */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📸 Attach Care Photo (Optional)</label>
            <div className="flex items-center gap-3">
              <label className="btn-outline py-2 px-3 text-xs flex items-center gap-1 cursor-pointer">
                {uploadingPhoto ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto || loading}
                />
              </label>

              {photoUrl ? (
                <div className="relative w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img src={photoUrl} alt="Attached Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600"
                  >
                    <X size={8} />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <ImageIcon size={10} /> No photo attached
                </span>
              )}
            </div>
          </div>

          {/* Logged by staff */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Staff Member</label>
            <input
              type="text"
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              className="input-field"
              placeholder="e.g. Raj"
            />
          </div>

          {/* WhatsApp toggle */}
          {reservation.pet?.owner?.whatsapp_number && (
            <div className="flex items-center gap-2 p-3 bg-sage-muted/40 border border-sage-light/20 rounded-xl">
              <input
                type="checkbox"
                id="send_whatsapp"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="w-4 h-4 text-sage border-gray-300 rounded focus:ring-sage"
              />
              <label htmlFor="send_whatsapp" className="text-xs text-gray-700 font-semibold cursor-pointer">
                📲 Send care update to owner via WhatsApp
              </label>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-outline py-2 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="btn-sage py-2 px-5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={14} /> Save Log
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
