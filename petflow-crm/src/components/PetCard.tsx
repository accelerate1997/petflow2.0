'use client'

import { useState } from 'react'
import { PawPrint, Weight, AlertTriangle, X, User } from 'lucide-react'
import type { Pet } from '@/types'
import { getTemperamentStyle } from '@/types'

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
  pet: Pet & { clients?: { name: string } }
}

export default function PetCard({ pet }: PetCardProps) {
  const [open, setOpen] = useState(false)
  const style = getTemperamentStyle(pet.temperament_notes)
  const photoUrl = pet.photo_url

  return (
    <>
      <div className="pet-card" onClick={() => setOpen(true)}>
        {/* Photo / Avatar */}
        <div
          style={{
            height: 160,
            background: photoUrl
              ? `url(${photoUrl}) center/cover no-repeat`
              : speciesGradient[pet.species] || speciesGradient.other,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {!photoUrl && (
            <span style={{ fontSize: '3.5rem' }}>{speciesEmoji[pet.species] || '🐾'}</span>
          )}

          {/* Temperament badge */}
          {pet.temperament_notes && (
            <span
              className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full border ${style.bg} ${style.color}`}
              style={{ fontSize: '0.7rem', fontWeight: 600 }}
            >
              <span
                className="inline-block rounded-full mr-1"
                style={{ width: 6, height: 6, background: style.dot.replace('bg-', ''), display: 'inline-block', verticalAlign: 'middle' }}
              />
              {pet.temperament_notes}
            </span>
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
          {pet.clients?.name && (
            <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              <User size={12} />
              <span>{pet.clients.name}</span>
            </div>
          )}
          {pet.medical_alerts && (
            <div
              className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-1.5"
              style={{ background: '#fff7ed', fontSize: '0.72rem', color: '#92400e' }}
            >
              <AlertTriangle size={11} />
              <span>{pet.medical_alerts}</span>
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
                  : speciesGradient[pet.species] || speciesGradient.other,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {!photoUrl && (
                <span style={{ fontSize: '4rem' }}>{speciesEmoji[pet.species] || '🐾'}</span>
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
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{pet.pet_name}</h2>
              {pet.temperament_notes && (
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${style.bg} ${style.color}`}
                >
                  {pet.temperament_notes}
                </span>
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
              {pet.clients?.name && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <User size={14} style={{ color: 'var(--sage)' }} />
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>Owner</span>
                  </div>
                  <p style={{ fontWeight: 600 }}>{pet.clients.name}</p>
                </div>
              )}
            </div>

            {pet.medical_alerts && (
              <div
                className="rounded-xl p-3 flex gap-2.5"
                style={{ background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: '1rem' }}
              >
                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.8rem', color: '#92400e', marginBottom: 2 }}>Medical Alert</p>
                  <p style={{ fontSize: '0.8rem', color: '#92400e' }}>{pet.medical_alerts}</p>
                </div>
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
          </div>
        </div>
      )}
    </>
  )
}
