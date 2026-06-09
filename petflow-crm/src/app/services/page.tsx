'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Tag, Trash2, Sparkles } from 'lucide-react'
import AddServiceModal from '@/components/AddServiceModal'
import type { Service } from '@/types'
import { getServices, deleteService as deleteServiceAction, getSettings } from '@/lib/actions'
import { formatCurrency as formatCurrencyHelper } from '@/lib/currency'
import { useRouter } from 'next/navigation'

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  const router = useRouter()

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const [data, settings] = await Promise.all([
        getServices(),
        getSettings()
      ])
      setServices(data as unknown as Service[])
      if (settings) {
        if (settings.currency_code) setCurrencyCode(settings.currency_code)
        if (settings.currency_symbol) setCurrencySymbol(settings.currency_symbol)
      }
    } catch (error: any) {
      console.error('Error fetching services:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchServices() }, [fetchServices])

  const handleDeleteService = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    try {
      await deleteServiceAction(id)
      fetchServices()
      router.refresh()
    } catch (error) {
      console.error('Error deleting service:', error)
    }
  }

  const filtered = services.filter(s => 
    s.service_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const formatCurrency = (n: number) =>
    formatCurrencyHelper(n, currencyCode)

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1200 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>Service Menu 🍱</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Manage spa offerings, pricing and specialized treatments
          </p>
        </div>
        <button className="btn-sage" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          New Service
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex items-center gap-4 mb-6">
        <div className="card flex-1 px-4 py-2.5 flex items-center gap-2">
          <Search size={16} style={{ color: '#9ca3af' }} />
          <input
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.875rem', color: 'var(--text)', width: '100%', background: 'transparent' }}
          />
        </div>
        <div className="card px-5 py-2.5 flex items-center gap-3">
           <Tag size={16} style={{ color: 'var(--sage-dark)' }} />
           <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{services.length} Active Services</p>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           {[...Array(6)].map((_, i) => (
             <div key={i} className="card h-48 animate-pulse" style={{ background: '#f3f4f6' }} />
           ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card h-64 flex flex-col items-center justify-center text-center text-gray-400">
          <Sparkles size={48} className="mb-4 opacity-20" />
          <p className="font-600">No services found</p>
          <p className="text-sm">Add your first spa treatment to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(service => (
            <div key={service.id} className="card p-5 group flex flex-col h-full hover:border-[#89A894] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="flex items-center justify-center rounded-2xl text-3xl"
                  style={{ width: 56, height: 56, background: 'var(--sage-muted)', color: 'var(--sage-dark)' }}
                >
                  {service.thumbnail?.startsWith('http') ? (
                    <img src={service.thumbnail} alt={service.service_name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    service.thumbnail || '✂️'
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => handleDeleteService(service.id)}
                     className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{service.service_name}</h3>
                  <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    service.pet_type === 'dog' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                    service.pet_type === 'cat' ? 'border-blue-200 bg-blue-50 text-blue-600' :
                    'border-gray-200 bg-gray-50 text-gray-500'
                  }`}>
                    {service.pet_type}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }} className="line-clamp-2">
                  {service.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t" style={{ borderColor: '#f3f4f6' }}>
                {(service.price_small != null || service.price_medium != null || service.price_large != null) ? (
                  /* ── Tiered pricing display ── */
                  <div className="flex flex-col gap-1.5">
                    {service.price_small != null && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[0.65rem] font-700 px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                          🐩 Small <span className="font-500" style={{ color: '#6b7280' }}>(&lt;10kg)</span>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatCurrency(service.price_small)}</span>
                      </div>
                    )}
                    {service.price_medium != null && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[0.65rem] font-700 px-2 py-0.5 rounded-full" style={{ background: '#fffbeb', color: '#d97706' }}>
                          🐕 Medium <span className="font-500" style={{ color: '#6b7280' }}>(10–25kg)</span>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatCurrency(service.price_medium)}</span>
                      </div>
                    )}
                    {service.price_large != null && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[0.65rem] font-700 px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>
                          🐕‍🦺 Large <span className="font-500" style={{ color: '#6b7280' }}>(&gt;25kg)</span>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatCurrency(service.price_large)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Flat price display ── */
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>PRICE</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServiceModal
          currencySymbol={currencySymbol}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchServices()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
