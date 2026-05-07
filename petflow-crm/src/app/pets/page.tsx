'use client'

import { useEffect, useState, useCallback } from 'react'
import { PawPrint, Plus, Search, SlidersHorizontal } from 'lucide-react'
import PetCard from '@/components/PetCard'
import AddPetModal from '@/components/AddPetModal'
import SetupBanner from '@/components/SetupBanner'
import { pb, isPocketBaseConfigured } from '@/lib/pocketbase'
import type { Pet } from '@/types'

type PetWithClient = Pet & { clients: { name: string } }

export default function PetsPage() {
  const [pets, setPets] = useState<PetWithClient[]>([])
  const [filtered, setFiltered] = useState<PetWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'dog' | 'cat' | 'other'>('all')
  const [temperamentFilter, setTemperamentFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)

  const fetchPets = useCallback(async () => {
    setLoading(true)
    if (!isPocketBaseConfigured) { setLoading(false); return }
    try {
      const records = await pb.collection('pets').getFullList({
        sort: '-created',
        expand: 'owner_id',
      })
      
      const mapped = records.map(record => ({
        ...record,
        clients: record.expand?.owner_id ? {
          name: record.expand.owner_id.name
        } : { name: 'Unknown' }
      })) as unknown as PetWithClient[]

      setPets(mapped)
    } catch (error) {
      console.error('Error fetching pets:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPets() }, [fetchPets])


  useEffect(() => {
    let result = [...pets]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.pet_name.toLowerCase().includes(q) ||
        (p.breed || '').toLowerCase().includes(q) ||
        (p.clients?.name || '').toLowerCase().includes(q)
      )
    }
    if (speciesFilter !== 'all') result = result.filter(p => p.species === speciesFilter)
    if (temperamentFilter !== 'all') result = result.filter(p =>
      (p.temperament_notes || '').toLowerCase().includes(temperamentFilter.toLowerCase())
    )
    setFiltered(result)
  }, [pets, search, speciesFilter, temperamentFilter])

  const temperamentOptions = ['all', 'Friendly', 'Calm', 'Anxious', 'Aggressive']
  const speciesOptions = [
    { value: 'all', label: 'All Pets' },
    { value: 'dog', label: '🐕 Dogs' },
    { value: 'cat', label: '🐈 Cats' },
    { value: 'other', label: '🐾 Other' },
  ]

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1300 }}>
      {!isPocketBaseConfigured && <SetupBanner />}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Pet Gallery 🐾
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {filtered.length} pet{filtered.length !== 1 ? 's' : ''} in your spa family
          </p>
        </div>
        <button className="btn-sage" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Add Pet
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1" style={{ minWidth: 220, background: 'var(--bg)', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.5rem 0.875rem' }}>
          <Search size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <input
            placeholder="Search pets, breeds, owners..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', color: 'var(--text)', width: '100%' }}
          />
        </div>

        {/* Species filter */}
        <div className="flex gap-2">
          {speciesOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSpeciesFilter(opt.value as any)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: speciesFilter === opt.value ? '1.5px solid var(--sage)' : '1.5px solid #e5e7eb',
                background: speciesFilter === opt.value ? 'var(--sage-muted)' : 'white',
                color: speciesFilter === opt.value ? 'var(--sage-dark)' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Temperament filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} style={{ color: '#9ca3af' }} />
          <select
            value={temperamentFilter}
            onChange={e => setTemperamentFilter(e.target.value)}
            style={{ border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.4rem 0.75rem', fontSize: '0.82rem', background: 'white', cursor: 'pointer', outline: 'none', color: '#374151' }}
          >
            {temperamentOptions.map(opt => (
              <option key={opt} value={opt}>{opt === 'all' ? 'All Temperaments' : opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl" style={{ height: 280, background: '#f3f4f6', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="card flex flex-col items-center justify-center text-center"
          style={{ height: 360, color: '#9ca3af' }}
        >
          <PawPrint size={48} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {pets.length === 0 ? 'No pets yet' : 'No results found'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            {pets.length === 0
              ? 'Add your first furry client to get started!'
              : 'Try adjusting your search or filters'}
          </p>
          {pets.length === 0 && (
            <button className="btn-sage mt-4" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add First Pet
            </button>
          )}
        </div>
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
        >
          {filtered.map(pet => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      )}

      {showModal && (
        <AddPetModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchPets}
        />
      )}
    </div>
  )
}
