'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Heart, Backpack, Dumbbell, AlertTriangle, FileSignature, Edit, RefreshCw } from 'lucide-react'
import { getPresignedUploadUrl, updateBoardingReservation } from '@/lib/actions'
import type { BoardingReservation } from '@/types'

interface CheckInModalProps {
  reservation: BoardingReservation
  onClose: () => void
  onSuccess: () => void
}

const HEALTH_OPTIONS = [
  'Clean & Healthy',
  'Matting',
  'Fleas/Ticks',
  'Rashes/Hotspots',
  'Anxiety/Stress',
  'Minor Wound/Scab',
  'Other'
]

export default function CheckInModal({ reservation, onClose, onSuccess }: CheckInModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Weight & Belongings & Notes
  const [weight, setWeight] = useState<number>(reservation.pet?.weight || 0)
  const [belongings, setBelongings] = useState<string>(reservation.check_in_belongings || '')
  const [feedingNotes, setFeedingNotes] = useState<string>(reservation.feeding_notes || '')
  const [medicationNotes, setMedicationNotes] = useState<string>(reservation.medication_notes || '')

  // Step 2: Health Inspection
  const [selectedHealthPills, setSelectedHealthPills] = useState<string[]>(
    reservation.check_in_health ? reservation.check_in_health.split(', ').filter(x => HEALTH_OPTIONS.includes(x)) : ['Clean & Healthy']
  )
  const [customHealthNotes, setCustomHealthNotes] = useState<string>(
    reservation.check_in_health && !HEALTH_OPTIONS.includes(reservation.check_in_health)
      ? reservation.check_in_health.split(' | ')[1] || ''
      : ''
  )

  // Step 3: Signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasSigned, setHasSigned] = useState(false)
  const isDrawing = useRef(false)

  // Initialize and scale Canvas for high DPI screens
  useEffect(() => {
    if (step === 3) {
      // Small timeout to ensure the modal transitions/renders and canvas has bounding box
      const timer = setTimeout(() => {
        initCanvas()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [step])

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    // Scale for high pixel density
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#6d8f7a' // Sage-dark
    }
    setHasSigned(false)
  }

  // Drawing event handlers using Pointer Events (mouse & touch)
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    isDrawing.current = true
    setHasSigned(true)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.releasePointerCapture(e.pointerId)
    isDrawing.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // reset scale
      const dpr = window.devicePixelRatio || 1
      ctx.resetTransform()
      ctx.scale(dpr, dpr)
    }
    setHasSigned(false)
  }

  const toggleHealthPill = (pill: string) => {
    if (pill === 'Clean & Healthy') {
      setSelectedHealthPills(['Clean & Healthy'])
      return
    }

    let next = selectedHealthPills.filter(x => x !== 'Clean & Healthy')
    if (next.includes(pill)) {
      next = next.filter(x => x !== pill)
      if (next.length === 0) next = ['Clean & Healthy']
    } else {
      next.push(pill)
    }
    setSelectedHealthPills(next)
  }

  const handleSubmit = async () => {
    if (!hasSigned) {
      setError('Owner signature is required to complete check-in.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not initialized')

      // 1. Convert Canvas to PNG Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })

      if (!blob) throw new Error('Could not capture signature image')

      // 2. Request presigned upload URL from R2
      const filename = `sig_${reservation.id}_${Date.now()}.png`
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(filename, 'image/png', 'signatures')

      // 3. Upload Blob directly to Cloudflare R2 via HTTP PUT
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload signature image to object storage.')
      }

      // 4. Construct check-in health string
      let healthText = selectedHealthPills.join(', ')
      if (customHealthNotes.trim()) {
        healthText += ` | ${customHealthNotes.trim()}`
      }

      // 5. Update database and change status to CheckedIn
      await updateBoardingReservation(reservation.id, {
        status: 'CheckedIn',
        check_in_weight: Number(weight),
        check_in_belongings: belongings.trim() || 'None',
        check_in_health: healthText,
        check_in_signature: publicUrl,
        feeding_notes: feedingNotes.trim(),
        medication_notes: medicationNotes.trim()
      })

      onSuccess()
    } catch (err: any) {
      console.error('Check-in save error:', err)
      setError(err.message || 'An unexpected error occurred while saving check-in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-[550px] flex flex-col p-6 rounded-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📥 Boarding Check-In</h2>
            <p className="text-xs text-gray-400">Guest: <span className="font-semibold text-sage-dark">{reservation.pet?.pet_name}</span> (Owner: {reservation.pet?.owner?.name})</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between my-4 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s 
                    ? 'bg-sage text-white ring-4 ring-sage-muted' 
                    : step > s 
                    ? 'bg-sage-dark text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {s}
              </div>
              <span className="text-xs font-semibold ml-2 text-gray-600">
                {s === 1 ? 'Details' : s === 2 ? 'Health' : 'Consent'}
              </span>
              {s < 3 && <div className={`flex-1 h-0.5 mx-3 transition-colors ${step > s ? 'bg-sage' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Weight */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">⚖️ Current Weight (kg)</label>
              <input 
                type="number" 
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                className="input-field" 
                placeholder="e.g. 12.5"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Prepopulated from pet profile</p>
            </div>

            {/* Belongings */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">🎒 Belongings / Inventory</label>
              <textarea 
                value={belongings}
                onChange={(e) => setBelongings(e.target.value)}
                rows={2}
                className="input-field py-2" 
                placeholder="e.g. Red collar, blue leash, Kong toy, 3 cans of Royal Canin"
              />
            </div>

            {/* Feeding Details */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">🍖 Feeding Instructions</label>
              <textarea 
                value={feedingNotes}
                onChange={(e) => setFeedingNotes(e.target.value)}
                rows={2}
                className="input-field py-2" 
                placeholder="Verify or update feeding instructions..."
              />
            </div>

            {/* Meds Details */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">💊 Medication Instructions</label>
              <textarea 
                value={medicationNotes}
                onChange={(e) => setMedicationNotes(e.target.value)}
                rows={2}
                className="input-field py-2" 
                placeholder="Verify or update medication notes..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Health Inspection */}
        {step === 2 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">🩺 Pre-existing Skin & Health Conditions</label>
              <div className="flex flex-wrap gap-2">
                {HEALTH_OPTIONS.map((pill) => {
                  const isSelected = selectedHealthPills.includes(pill)
                  return (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => toggleHealthPill(pill)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        isSelected 
                          ? 'bg-sage-muted text-sage-dark border-sage' 
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pill}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">📝 Custom Health Notes</label>
              <textarea 
                value={customHealthNotes}
                onChange={(e) => setCustomHealthNotes(e.target.value)}
                rows={4}
                className="input-field py-2" 
                placeholder="Write specific notes about rashes, hotspots, scabs, or other skin conditions observed..."
              />
            </div>
          </div>
        )}

        {/* Step 3: Signature Consent */}
        {step === 3 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="bg-sage-muted/40 border border-sage-light/30 rounded-xl p-3.5 text-xs text-sage-dark leading-relaxed">
              <p className="font-semibold mb-1">📋 Terms of Boarding Consent</p>
              I authorize PetFlow Spa to board my pet, administer feeding/medications as instructed, and obtain emergency veterinary care if deemed necessary. I certify that all details above are accurate.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-600">✍️ Owner digital signature</label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer"
                >
                  <RefreshCw size={12} /> Clear Drawing
                </button>
              </div>
              
              {/* Canvas drawing container */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-44 block bg-white"
                  style={{ touchAction: 'none' }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Use finger or mouse cursor to draw signature inside the box above.</p>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={loading}
                className="btn-outline py-2 px-4"
              >
                Back
              </button>
            )}
          </div>
          
          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="btn-sage py-2 px-5"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-sage py-2 px-5 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    Confirm Check-In 🐾
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
