'use client'

import { useState, useTransition } from 'react'
import { PawPrint, Weight, AlertTriangle, X, User, Syringe, Plus, Trash2, Calendar, Loader2, Clock, Edit2 } from 'lucide-react'
import type { Pet, VaccinationRecord } from '@/types'
import { getTemperamentStyle } from '@/types'
import { addVaccinationRecord, deleteVaccinationRecord } from '@/lib/actions'
import { format } from 'date-fns'
import AddPetModal from './AddPetModal'

const speciesEmoji: Record<string, string> = {
  dog: '🐕',
  cat: '🐈',
  other: '🐾',
}

const speciesGradient: Record<string, string> = {
  dog: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)',
  cat: 'linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 100%)',
  other: 'linear-gradient(135deg, #a5f3fc 0%, #06b6d4 100%)',
}

interface PetCardProps {
  pet: Pet
}

export default function PetCard({ pet }: PetCardProps) {
  const [open, setOpen] = useState(false)
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>(pet.vaccinations || [])
  const [showLogForm, setShowLogForm] = useState(false)
  const [vaccineName, setVaccineName] = useState('')
  const [administeredDate, setAdministeredDate] = useState('')
  const [boosterDate, setBoosterDate] = useState('')
  const [vaccineNotes, setVaccineNotes] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const style = getTemperamentStyle(pet.temperament_notes)
  const photoUrl = pet.photo

  return (
    <>
      <div className="pet-card" onClick={() => setOpen(true)}>
        {/* Photo / Avatar */}
        <div
          style={{
            height: 160,
            background: photoUrl
              ? `url(${photoUrl}) center/cover no-repeat`
              : speciesGradient[pet.species || 'other'] || speciesGradient.other,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {!photoUrl && (
            <span style={{ fontSize: '3.5rem' }}>{speciesEmoji[pet.species || 'other'] || '🐾'}</span>
          )}

          {/* Temperament badges */}
          {pet.temperament_notes && (
            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
              {pet.temperament_notes.split(',').map(s => s.trim()).filter(Boolean).map((t, idx) => {
                const ts = getTemperamentStyle(t)
                return (
                  <span
                    key={idx}
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ts.bg} ${ts.color} shadow-sm bg-white/90 backdrop-blur-sm`}
                    style={{ fontSize: '0.65rem', fontWeight: 700 }}
                  >
                    {t}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-1">
            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1a' }}>{pet.pet_name}</h3>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{pet.species}</span>
          </div>
          {pet.breed && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>{pet.breed}</p>
          )}
          {pet.owner?.name && (
            <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              <User size={12} />
              <span>{pet.owner.name}</span>
            </div>
          )}
          {pet.medical_alerts && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pet.medical_alerts.split(',').map(s => s.trim()).filter(Boolean).map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded-lg px-2 py-1"
                  style={{ background: '#fef2f2', border: '1px solid #fee2e2', fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}
                >
                  <AlertTriangle size={10} className="text-red-500" />
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          )}

          {vaccinations.some(r => r.status === 'Overdue') && (
            <div
              className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-1.5 animate-pulse"
              style={{ background: '#fef2f2', fontSize: '0.72rem', color: '#b91c1c', border: '1px solid #fee2e2' }}
            >
              <AlertTriangle size={11} className="text-red-500" />
              <span>Overdue Vaccination</span>
            </div>
          )}
          {!vaccinations.some(r => r.status === 'Overdue') && vaccinations.some(r => r.status === 'Due Soon') && (
            <div
              className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-1.5"
              style={{ background: '#fffbeb', fontSize: '0.72rem', color: '#b45309', border: '1px solid #fef3c7' }}
            >
              <AlertTriangle size={11} className="text-amber-500" />
              <span>Vaccination Due Soon</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer / Modal */}
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            {/* Header photo */}
            <div
              style={{
                height: 180,
                borderRadius: '0.875rem',
                marginBottom: '1.25rem',
                background: photoUrl
                  ? `url(${photoUrl}) center/cover no-repeat`
                  : speciesGradient[pet.species || 'other'] || speciesGradient.other,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {!photoUrl && (
                <span style={{ fontSize: '4rem' }}>{speciesEmoji[pet.species || 'other'] || '🐾'}</span>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(255,255,255,0.9)', border: 'none',
                  borderRadius: '50%', width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{pet.pet_name}</h2>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1.5 text-gray-400 hover:text-[var(--sage-dark)] hover:bg-[var(--sage-muted)] rounded-lg transition-colors"
                  title="Edit Pet"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              {pet.temperament_notes && (
                <div className="flex flex-wrap gap-1">
                  {pet.temperament_notes.split(',').map(s => s.trim()).filter(Boolean).map((t, idx) => {
                    const ts = getTemperamentStyle(t)
                    return (
                      <span
                        key={idx}
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ts.bg} ${ts.color}`}
                      >
                        {t}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {pet.breed || pet.species} · {pet.species}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {pet.weight && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Weight size={14} style={{ color: 'var(--sage)' }} />
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>Weight</span>
                  </div>
                  <p style={{ fontWeight: 600 }}>{pet.weight} kg</p>
                </div>
              )}
              {pet.owner?.name && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <User size={14} style={{ color: 'var(--sage)' }} />
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>Owner</span>
                  </div>
                  <p style={{ fontWeight: 600 }}>{pet.owner.name}</p>
                </div>
              )}
            </div>

            {pet.medical_alerts && (
              <div className="flex flex-wrap gap-2 mb-4 mt-2">
                {pet.medical_alerts.split(',').map(s => s.trim()).filter(Boolean).map((alert, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-2.5 flex items-center gap-2"
                    style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
                  >
                    <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#b91c1c' }}>{alert}</span>
                  </div>
                ))}
              </div>
            )}

            {pet.temperament_notes && (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <PawPrint size={14} style={{ color: 'var(--sage)' }} />
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>Temperament Notes</span>
                </div>
                <p style={{ fontSize: '0.875rem' }}>{pet.temperament_notes}</p>
              </div>
            )}

            {/* Vaccinations Section */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-gray-800">
                  <Syringe size={14} style={{ color: 'var(--sage)' }} />
                  Vaccinations
                </h3>
                <button
                  onClick={() => setShowLogForm(!showLogForm)}
                  className="text-xs font-bold text-[var(--sage-dark)] hover:underline flex items-center gap-0.5"
                >
                  <Plus size={12} />
                  Log Vaccine
                </button>
              </div>

              {/* Log Form */}
              {showLogForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!vaccineName || !administeredDate || !boosterDate) return
                    startTransition(async () => {
                      try {
                        const administered = new Date(administeredDate)
                        const due_date = new Date(boosterDate)
                        
                        // Calculate status
                        const today = new Date()
                        let status = 'Active'
                        if (due_date < today) {
                          status = 'Overdue'
                        } else {
                          const diffTime = Math.abs(due_date.getTime() - today.getTime())
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          if (diffDays <= 14) {
                            status = 'Due Soon'
                          }
                        }

                        const newRec = await addVaccinationRecord({
                          pet_id: pet.id,
                          vaccine_name: vaccineName,
                          administered,
                          due_date,
                          status,
                          notes: vaccineNotes
                        })
                        
                        setVaccinations(prev => [...prev, newRec as unknown as VaccinationRecord])
                        setVaccineName('')
                        setAdministeredDate('')
                        setBoosterDate('')
                        setVaccineNotes('')
                        setShowLogForm(false)
                      } catch (err) {
                        console.error('Error logging vaccine:', err)
                      }
                    })
                  }}
                  className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4 flex flex-col gap-2"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vaccine Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Rabies, DHPP"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                      value={vaccineName}
                      onChange={e => setVaccineName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date Given</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                        value={administeredDate}
                        onChange={e => setAdministeredDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Next Due Date</label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                        value={boosterDate}
                        onChange={e => setBoosterDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="Batch number, doctor, etc."
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                      value={vaccineNotes}
                      onChange={e => setVaccineNotes(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-1.5 bg-[var(--sage-dark)] text-white text-xs font-bold rounded-lg hover:bg-[var(--sage-dark)]/90 transition-all flex items-center justify-center gap-1"
                  >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : 'Log Record'}
                  </button>
                </form>
              )}

              {/* Vaccine List */}
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {vaccinations.length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-200 text-center">
                    No vaccinations logged yet.
                  </p>
                ) : (
                  vaccinations.map(record => {
                    const isOverdue = record.status === 'Overdue'
                    const isDueSoon = record.status === 'Due Soon'
                    return (
                      <div
                        key={record.id}
                        className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-start justify-between gap-3 shadow-sm hover:border-gray-200 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-gray-700 truncate">{record.vaccine_name}</span>
                            <span
                              className={`px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide rounded ${
                                isOverdue
                                  ? 'bg-red-50 text-red-700 border border-red-100'
                                  : isDueSoon
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}
                            >
                              {record.status}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px] text-gray-400">
                            <p className="flex items-center gap-1">
                              <Calendar size={10} />
                              Given: {format(new Date(record.administered), 'MMM d, yyyy')}
                            </p>
                            <p className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : 'text-gray-400'}`}>
                              <Clock size={10} />
                              Booster: {format(new Date(record.due_date), 'MMM d, yyyy')}
                            </p>
                            {record.notes && <p className="italic mt-0.5 text-gray-400 truncate">Note: {record.notes}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Delete the ${record.vaccine_name} record?`)) {
                              startTransition(async () => {
                                try {
                                  await deleteVaccinationRecord(record.id)
                                  setVaccinations(prev => prev.filter(r => r.id !== record.id))
                                } catch (err) {
                                  console.error('Error deleting vaccine:', err)
                                }
                              })
                            }
                          }}
                          className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete vaccination"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <AddPetModal
          existingPet={pet}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
