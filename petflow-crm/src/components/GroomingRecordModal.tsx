'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Camera, Upload, Trash2, Save, FileText, Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react'
import { saveGroomingRecord, getPresignedUploadUrl } from '@/lib/actions'
import type { Appointment } from '@/types'

interface Props {
  appointment: Appointment
  onClose: () => void
  onSuccess: () => void
}

// ─── Photo Item Interface ────────────────────────────────────────
interface PhotoItem {
  preview: string // base64 or remote URL
  file: Blob | null // null if already uploaded to R2
  url?: string // existing R2 URL
}

// ─── Client-side WebP compression via Canvas ────────────────────
interface CompressedResult {
  previewUrl: string
  blob: Blob
}

async function compressToWebP(file: File, maxWidth = 900, quality = 0.78): Promise<CompressedResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, width, height)
        
        const previewUrl = canvas.toDataURL('image/webp', quality)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ previewUrl, blob })
          } else {
            reject(new Error('Canvas compression failed'))
          }
        }, 'image/webp', quality)
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

function getApproxSizeKB(item: PhotoItem) {
  if (item.file) {
    return Math.round(item.file.size / 1024)
  }
  if (item.preview && item.preview.startsWith('data:')) {
    return Math.round((item.preview.length * 0.75 - 814) / 1024)
  }
  return null
}

// ─── Photo Slot Component ────────────────────────────────────────
interface PhotoSlotProps {
  type: 'before' | 'after'
  photos: PhotoItem[]
  onAdd: (type: 'before' | 'after', item: PhotoItem) => void
  onRemove: (type: 'before' | 'after', index: number) => void
}

function PhotoPanel({ type, photos, onAdd, onRemove }: PhotoSlotProps) {
  const [compressing, setCompressing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const isBefore = type === 'before'
  const accentColor = isBefore ? '#f59e0b' : '#7c3aed'
  const bgColor = isBefore ? 'rgba(245,158,11,0.08)' : 'rgba(124,58,237,0.08)'
  const borderColor = isBefore ? '#fde68a' : '#ddd6fe'
  const label = isBefore ? 'Before' : 'After'

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return
    setCompressing(true)
    try {
      const { previewUrl, blob } = await compressToWebP(file)
      onAdd(type, { preview: previewUrl, file: blob })
    } catch {
      alert('Could not process image. Please try a different file.')
    } finally {
      setCompressing(false)
    }
  }, [type, onAdd])

  return (
    <div className="flex flex-col h-full" style={{ flex: 1 }}>
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl mb-2"
        style={{ background: bgColor, border: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: accentColor }}
          />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
            {label}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: accentColor, color: 'white', opacity: 0.85 }}
          >
            {photos.length}
          </span>
        </div>
        <div className="flex gap-1">
          {/* Camera capture */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={compressing}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
            style={{ background: accentColor, color: 'white', opacity: compressing ? 0.5 : 1 }}
            title="Take photo with camera"
          >
            <Camera size={10} />
            Camera
          </button>
          {/* Gallery upload */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={compressing}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
            style={{ borderColor, color: accentColor, background: 'white', opacity: compressing ? 0.5 : 1 }}
            title="Upload from gallery"
          >
            <Upload size={10} />
            Upload
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
          onClick={e => ((e.target as HTMLInputElement).value = '')}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
          onClick={e => ((e.target as HTMLInputElement).value = '')}
        />
      </div>

      {/* Photos grid */}
      <div
        className="flex-1 rounded-xl overflow-y-auto p-2"
        style={{ background: '#fafafa', border: `1px solid ${borderColor}`, minHeight: 180, maxHeight: 260 }}
      >
        {compressing && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold" style={{ color: accentColor }}>
            <Loader2 size={14} className="animate-spin" />
            Compressing to WebP…
          </div>
        )}

        {photos.length === 0 && !compressing && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6 text-gray-300 text-center">
            <ImageIcon size={28} strokeWidth={1.5} />
            <p className="text-[10px] font-semibold uppercase tracking-wider">No {label} photos yet</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {photos.map((item, i) => (
            <div
              key={i}
              className="relative rounded-lg overflow-hidden group"
              style={{ aspectRatio: '4/3', border: `1px solid ${borderColor}` }}
            >
              <img src={item.preview} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
              {/* Size badge */}
              <div
                className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
              >
                {getApproxSizeKB(item) ? `${getApproxSizeKB(item)} KB · ` : ''}WebP
              </div>
              {/* Delete */}
              <button
                type="button"
                onClick={() => onRemove(type, i)}
                className="absolute top-1 right-1 p-1 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: 'rgba(220,38,38,0.85)' }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────
export default function GroomingRecordModal({ appointment, onClose, onSuccess }: Props) {
  const [notes, setNotes] = useState(appointment.grooming_notes || '')
  const [beforePhotos, setBeforePhotos] = useState<PhotoItem[]>(() =>
    (appointment.before_photos || []).map((url: string) => ({ preview: url, file: null, url }))
  )
  const [afterPhotos, setAfterPhotos] = useState<PhotoItem[]>(() =>
    (appointment.after_photos || []).map((url: string) => ({ preview: url, file: null, url }))
  )
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = useCallback((type: 'before' | 'after', item: PhotoItem) => {
    if (type === 'before') setBeforePhotos(p => [...p, item])
    else setAfterPhotos(p => [...p, item])
  }, [])

  const handleRemove = useCallback((type: 'before' | 'after', index: number) => {
    if (type === 'before') setBeforePhotos(p => p.filter((_, i) => i !== index))
    else setAfterPhotos(p => p.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // 1. Upload new beforePhotos to R2
      const beforeUrls = await Promise.all(
        beforePhotos.map(async (photo) => {
          if (photo.url) return photo.url
          if (!photo.file) throw new Error('File missing for new photo')
          
          const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
            'before.webp',
            'image/webp',
            'grooming'
          )
          
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/webp' },
            body: photo.file
          })
          
          if (!uploadRes.ok) {
            throw new Error('Failed to upload before grooming photo to R2.')
          }
          
          return publicUrl
        })
      )

      // 2. Upload new afterPhotos to R2
      const afterUrls = await Promise.all(
        afterPhotos.map(async (photo) => {
          if (photo.url) return photo.url
          if (!photo.file) throw new Error('File missing for new photo')
          
          const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
            'after.webp',
            'image/webp',
            'grooming'
          )
          
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/webp' },
            body: photo.file
          })
          
          if (!uploadRes.ok) {
            throw new Error('Failed to upload after grooming photo to R2.')
          }
          
          return publicUrl
        })
      )

      await saveGroomingRecord(appointment.id, {
        grooming_notes: notes,
        before_photos: beforeUrls,
        after_photos: afterUrls,
      })
      setSaved(true)
      setTimeout(() => { onSuccess(); onClose() }, 900)
    } catch (err: any) {
      setError(err.message || 'Failed to save record')
    }
    setLoading(false)
  }

  const petName = (appointment as any).pets?.pet_name || 'Pet'
  const groomerName = appointment.groomer?.name

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 680, width: '96vw', padding: 0, overflow: 'hidden' }}
      >
        {/* ── Header gradient ── */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 60%, #7c3aed 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Grooming Record</h2>
              <p className="text-purple-200 text-xs mt-0.5">
                {petName} · {appointment.service_type}
                {groomerName && <> · ✂️ {groomerName}</>}
                <> · <span className="font-semibold">{appointment.appointment_date}</span></>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5">
          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Grooming Notes ── */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <FileText size={13} className="text-gray-400" />
                Style Notes & Instructions
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-purple-300 transition-all"
                placeholder='e.g., "Blade #4 on body, rounded face, teddy bear paws, clean ears…"'
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* ── Before / After panels ── */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                <ImageIcon size={13} className="text-gray-400" />
                Transformation Photos
                <span className="text-[10px] font-normal text-gray-400 ml-1">
                  — auto-compressed to WebP
                </span>
              </label>
              <div className="flex gap-3">
                <PhotoPanel
                  type="before"
                  photos={beforePhotos}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                />
                {/* Divider arrow */}
                <div className="flex items-center justify-center flex-shrink-0 self-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-8 w-px bg-gray-200" />
                    <span className="text-lg">→</span>
                    <div className="h-8 w-px bg-gray-200" />
                  </div>
                </div>
                <PhotoPanel
                  type="after"
                  photos={afterPhotos}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || saved}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                style={{
                  background: saved
                    ? 'linear-gradient(135deg,#059669,#10b981)'
                    : 'linear-gradient(135deg,#6d28d9,#7c3aed)',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {saved ? (
                  <><CheckCircle size={16} /> Saved!</>
                ) : loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={16} /> Save Grooming Log</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
