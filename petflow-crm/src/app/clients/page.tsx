'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Phone, Mail, MapPin, Trash2, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react'
import AddClientModal from '@/components/AddClientModal'
import AddPetModal from '@/components/AddPetModal'
import CheckoutModal from '@/components/CheckoutModal'
import type { Client, Pet } from '@/types'
import { getTemperamentStyle } from '@/types'
import { getClients, deleteClient as deleteClientAction, getSettings } from '@/lib/actions'
import { formatCurrency as formatCurrencyHelper } from '@/lib/currency'
import { useRouter } from 'next/navigation'

type ClientWithPets = Client & { pets: Pet[] }

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithPets[]>([])
  const [filtered, setFiltered] = useState<ClientWithPets[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [showAddPet, setShowAddPet] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutClientId, setCheckoutClientId] = useState<string | undefined>()
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const router = useRouter()

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const [data, settings] = await Promise.all([
        getClients(),
        getSettings()
      ])
      setClients(data as any)
      if (settings?.currency_code) {
        setCurrencyCode(settings.currency_code)
      }
    } catch (error: any) {
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
    formatCurrencyHelper(n, currencyCode)

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Delete this client and all their pets?')) return
    try {
      await deleteClientAction(id)
      fetchClients()
      router.refresh()
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Pet Parents 👪</h1>
          <p className="text-gray-400 text-sm">Manage your client database and history</p>
        </div>
        <button className="btn-sage w-full md:w-auto justify-center" onClick={() => setShowAddClient(true)}>
          <Plus size={16} />
          Add Parent
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
                  className="flex items-center gap-4 p-4 md:p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : client.id)}
                >
                  {/* Avatar Section */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="flex items-center justify-center rounded-2xl font-bold"
                      style={{ 
                        width: 52, height: 52, 
                        background: 'linear-gradient(135deg, var(--sage-muted) 0%, #e0e9e3 100%)', 
                        fontSize: '1.2rem', color: 'var(--sage-dark)',
                        border: '2px solid white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    {client.pets?.length > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-sage-dark text-white rounded-full flex items-center justify-center border-2 border-white" style={{ fontSize: '0.6rem', fontWeight: 800 }}>
                        {client.pets.length}
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-800 text-[1rem] md:text-[1.05rem] truncate mb-0.5">{client.name}</p>
                    
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-3">
                        {client.whatsapp_number && (
                          <span className="flex items-center gap-1 text-gray-500 font-500" style={{ fontSize: '0.78rem' }}>
                            <Phone size={11} className="text-sage" /> {client.whatsapp_number}
                          </span>
                        )}
                        {client.email && (
                          <span className="hidden sm:flex items-center gap-1 text-gray-400" style={{ fontSize: '0.75rem' }}>
                            <Mail size={11} /> {client.email.split('@')[0]}...
                          </span>
                        )}
                      </div>
                      
                      {client.address && (
                        <span className="flex items-center gap-1 text-gray-400 truncate max-w-[200px] md:max-w-[240px]" style={{ fontSize: '0.72rem' }}>
                          <MapPin size={11} className="flex-shrink-0" /> {client.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric Section */}
                  <div className="flex items-center gap-3">
                    <div className="hidden xs:flex flex-col items-end px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-[0.6rem] text-gray-400 font-700 uppercase tracking-tighter">Total Spent</span>
                      <span className="text-[0.95rem] font-800 text-gray-800">
                        {formatCurrency(client.total_spend || 0)}
                      </span>
                    </div>
                    
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-sage-dark text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded: pet list + actions */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '1.25rem' }} className="bg-[#fcfcfb]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                      <div>
                        <h4 className="text-sm font-800 text-gray-700 mb-1">Detailed Profile</h4>
                        <div className="flex flex-wrap gap-3">
                          {client.whatsapp_number && (
                            <a 
                              href={`https://wa.me/${client.whatsapp_number.replace(/\D/g, '')}`} 
                              target="_blank"
                              className="text-[0.75rem] flex items-center gap-1.5 text-sage-dark font-700 hover:underline"
                            >
                              <Phone size={12} /> WhatsApp Client
                            </a>
                          )}
                          {client.email && (
                            <span className="text-[0.75rem] flex items-center gap-1.5 text-gray-400">
                              <Mail size={12} /> {client.email}
                            </span>
                          )}
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCheckoutClientId(client.id); 
                              setShowCheckout(true) 
                            }}
                            className="text-[0.75rem] flex items-center gap-1.5 text-blue-600 font-700 hover:underline"
                          >
                            <ShoppingBag size={12} /> Sell Product
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-outline !py-1.5 !px-3 !text-[0.75rem]"
                          onClick={(e) => { e.stopPropagation(); setSelectedClientId(client.id); setShowAddPet(true) }}
                        >
                          <Plus size={13} /> Add Pet
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-[0.75rem] font-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-[0.65rem] font-800 text-gray-400 uppercase tracking-widest">Registered Pets</h5>
                      {!client.pets || client.pets.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No pets found for this parent.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {client.pets.map(pet => {
                            const style = getTemperamentStyle(pet.temperament_notes)
                            return (
                              <div
                                key={pet.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-lg">
                                    {speciesEmoji[pet.species || 'other'] || '🐾'}
                                  </div>
                                  <div>
                                    <p className="font-700 text-gray-800 text-sm">{pet.pet_name}</p>
                                    <p className="text-[0.7rem] text-gray-400">{pet.breed || pet.species}</p>
                                  </div>
                                </div>
                                {pet.temperament_notes && (
                                  <span
                                    className={`text-[0.6rem] px-2 py-0.5 rounded-full border font-800 uppercase ${style.bg} ${style.color}`}
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAddClient && (
        <AddClientModal
          currencySymbol={currencySymbol}
          onClose={() => setShowAddClient(false)}
          onSuccess={() => {
            fetchClients()
            router.refresh()
          }}
        />
      )}

      {showAddPet && (
        <AddPetModal
          onClose={() => { setShowAddPet(false); setSelectedClientId(undefined) }}
          onSuccess={() => {
            fetchClients()
            router.refresh()
          }}
          preselectedOwnerId={selectedClientId}
        />
      )}

      {showCheckout && (
        <CheckoutModal 
          clientId={checkoutClientId}
          onClose={() => { setShowCheckout(false); setCheckoutClientId(undefined) }}
          onSuccess={fetchClients}
        />
      )}
    </div>
  )
}
