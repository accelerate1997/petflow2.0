'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Phone, Mail, MapPin, PawPrint, Trash2, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react'
import AddClientModal from '@/components/AddClientModal'
import AddPetModal from '@/components/AddPetModal'
import SetupBanner from '@/components/SetupBanner'
import { pb, isPocketBaseConfigured } from '@/lib/pocketbase'
import type { Client, Pet } from '@/types'
import { getTemperamentStyle } from '@/types'

type ClientWithPets = Client & { pets: Pet[] }

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithPets[]>([])
  const [filtered, setFiltered] = useState<ClientWithPets[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [showAddPet, setShowAddPet] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    if (!isPocketBaseConfigured) { setLoading(false); return }

    try {
      const records = await pb.collection('clients').getFullList({
        sort: '-created',
        expand: 'pets(owner_id)',
      })
      
      const mapped = records.map(record => ({
        ...record,
        pets: record.expand?.['pets(owner_id)'] || []
      })) as unknown as ClientWithPets[]

      setClients(mapped)
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  useEffect(() => {
    if (!search) { setFiltered(clients); return }
    const q = search.toLowerCase()
    setFiltered(clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.whatsapp_number || '').includes(q)
    ))
  }, [clients, search])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const deleteClient = async (id: string) => {
    if (!confirm('Delete this client and all their pets?')) return
    try {
      await pb.collection('clients').delete(id)
      fetchClients()
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1000 }}>
      {!isPocketBaseConfigured && <SetupBanner />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>Pet Parents 👤</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {filtered.length} client{filtered.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button className="btn-sage" onClick={() => setShowAddClient(true)}>
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div className="card px-4 py-3 mb-5 flex items-center gap-2">
        <Search size={16} style={{ color: '#9ca3af' }} />
        <input
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: '0.875rem', color: 'var(--text)', width: '100%', background: 'transparent' }}
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl" style={{ height: 80, background: '#f3f4f6' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center" style={{ height: 280, color: '#9ca3af' }}>
          <p style={{ fontWeight: 600, fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {clients.length === 0 ? 'No clients yet' : 'No results found'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            {clients.length === 0 ? 'Add your first pet parent!' : 'Try a different search term'}
          </p>
          {clients.length === 0 && (
            <button className="btn-sage mt-4" onClick={() => setShowAddClient(true)}>
              <Plus size={15} /> Add First Client
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(client => {
            const isExpanded = expandedId === client.id
            return (
              <div key={client.id} className="card overflow-hidden">
                {/* Main row */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : client.id)}
                >
                  {/* Avatar */}
                  <div
                    className="flex items-center justify-center rounded-2xl flex-shrink-0"
                    style={{ width: 48, height: 48, background: 'var(--sage-muted)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--sage-dark)' }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{client.name}</p>
                      {client.pets?.length > 0 && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--sage-muted)', color: 'var(--sage-dark)', padding: '0.15rem 0.5rem', borderRadius: '99px', fontWeight: 600 }}>
                          {client.pets.length} pet{client.pets.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {client.whatsapp_number && (
                        <span className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          <Phone size={11} /> {client.whatsapp_number}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          <Mail size={11} /> {client.email}
                        </span>
                      )}
                      {client.address && (
                        <span className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          <MapPin size={11} /> {client.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Spend + chevron */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 2 }}>Total Spend</p>
                      <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>
                        {formatCurrency(client.total_spend || 0)}
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp size={18} style={{ color: '#9ca3af' }} />
                      : <ChevronDown size={18} style={{ color: '#9ca3af' }} />
                    }
                  </div>
                </div>

                {/* Expanded: pet list + actions */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '1rem 1.25rem 1.25rem' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                        Pets ({client.pets?.length || 0})
                      </h4>
                      <div className="flex gap-2">
                        <button
                          className="btn-outline"
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => { setSelectedClientId(client.id); setShowAddPet(true) }}
                        >
                          <Plus size={13} /> Add Pet
                        </button>
                        <button
                          onClick={() => deleteClient(client.id)}
                          style={{ background: '#fef2f2', border: '1.5px solid #fecaca', color: '#ef4444', borderRadius: '0.625rem', padding: '0.3rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>

                    {!client.pets || client.pets.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>No pets registered yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {client.pets.map(pet => {
                          const style = getTemperamentStyle(pet.temperament_notes)
                          return (
                            <div
                              key={pet.id}
                              className="flex items-center gap-2 rounded-xl px-3 py-2"
                              style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.06)' }}
                            >
                              <span style={{ fontSize: '1.1rem' }}>{speciesEmoji[pet.species] || '🐾'}</span>
                              <div>
                                <p style={{ fontWeight: 600, fontSize: '0.82rem' }}>{pet.pet_name}</p>
                                <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{pet.breed || pet.species}</p>
                              </div>
                              {pet.temperament_notes && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.color}`}
                                  style={{ fontSize: '0.68rem', fontWeight: 600 }}
                                >
                                  {pet.temperament_notes}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSuccess={fetchClients}
        />
      )}

      {showAddPet && (
        <AddPetModal
          onClose={() => { setShowAddPet(false); setSelectedClientId(undefined) }}
          onSuccess={fetchClients}
          preselectedOwnerId={selectedClientId}
        />
      )}
    </div>
  )
}
