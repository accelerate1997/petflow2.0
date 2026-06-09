'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCw, Scissors, Gift, Calendar, User, ShoppingBag, Plus } from 'lucide-react'
import { getServices, getStaff, getProducts, addBoardingServiceAddon, addBoardingProductAddon } from '@/lib/actions'
import { getLocalDateString } from '@/lib/dateUtils'
import type { BoardingReservation, Service, Staff, Product } from '@/types'

interface Props {
  reservation: BoardingReservation
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

type Tab = 'service' | 'product'

export default function AddOnServiceModal({ reservation, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const [tab, setTab] = useState<Tab>('service')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Options fetched from database
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)

  // Spa service form states
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [servicePrice, setServicePrice] = useState<number>(0)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [apptDate, setApptDate] = useState(getLocalDateString())
  const [apptTime, setApptTime] = useState('11:00')

  // Product sale form states
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productQty, setProductQty] = useState(1)

  // Fetch lists on load
  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true)
      try {
        const [srvs, stf, prds] = await Promise.all([
          getServices(),
          getStaff(true),
          getProducts()
        ])
        setServices(srvs as Service[])
        setStaffList(stf as Staff[])
        // Only keep active products that are in stock
        setProducts((prds as Product[]).filter(p => p.is_active && p.stock > 0))
      } catch (err: any) {
        console.error('Error loading options:', err)
        setError('Failed to load services and products list.')
      } finally {
        setOptionsLoading(false)
      }
    }
    loadOptions()
  }, [])

  // Auto-populate price when service is chosen
  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id)
    const s = services.find(x => x.id === id)
    if (s) {
      // Find appropriate price based on pet weight
      const weight = reservation.pet?.weight || 0
      if (weight > 0 && weight < 10 && s.price_small) {
        setServicePrice(s.price_small)
      } else if (weight >= 10 && weight <= 25 && s.price_medium) {
        setServicePrice(s.price_medium)
      } else if (weight > 25 && s.price_large) {
        setServicePrice(s.price_large)
      } else {
        setServicePrice(s.price)
      }
    } else {
      setServicePrice(0)
    }
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (tab === 'service') {
        if (!selectedServiceId) throw new Error('Please select a service.')
        const s = services.find(x => x.id === selectedServiceId)
        if (!s) throw new Error('Selected service is invalid.')

        await addBoardingServiceAddon({
          reservation_id: reservation.id,
          service_type: s.service_name,
          price: Number(servicePrice),
          groomer_id: selectedStaffId || null,
          appointment_date: apptDate,
          appointment_time: apptTime
        })
      } else {
        if (!selectedProductId) throw new Error('Please select a product.')
        if (productQty < 1) throw new Error('Quantity must be at least 1.')
        if (selectedProduct && productQty > selectedProduct.stock) {
          throw new Error(`Cannot exceed available stock of ${selectedProduct.stock} units.`)
        }

        await addBoardingProductAddon({
          reservation_id: reservation.id,
          product_id: selectedProductId,
          quantity: Number(productQty)
        })
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error saving stay add-on:', err)
      setError(err.message || 'An error occurred while saving the add-on item.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-[480px] flex flex-col p-6 rounded-2xl relative bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">➕ Add Item During Stay</h2>
            <p className="text-xs text-gray-400">
              Boarder: <span className="font-semibold text-sage-dark">{reservation.pet?.pet_name}</span>
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

        {/* Tab selection */}
        <div className="flex bg-gray-100 p-0.5 rounded-xl my-4 border border-gray-200">
          <button
            type="button"
            onClick={() => { setTab('service'); setError(null) }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'service' ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scissors size={14} /> 💈 Spa Treatment
          </button>
          <button
            type="button"
            onClick={() => { setTab('product'); setError(null) }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'product' ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Gift size={14} /> 🍖 Treats / Retail Product
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-start gap-2">
            <X size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {optionsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
            <RefreshCw size={24} className="animate-spin" />
            <p className="text-xs">Loading items and prices...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 💈 SPA SERVICE FORM */}
            {tab === 'service' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select Service</label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Select a treatment...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.service_name} (Base: {currencySymbol}{s.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Price ({currencySymbol})</label>
                    <input
                      type="number"
                      value={servicePrice}
                      onChange={(e) => setServicePrice(Number(e.target.value) || 0)}
                      className="input-field"
                      placeholder="Price"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Groomer / Staff</label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Assign later...</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.role || 'Groomer'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                    <div className="form-group">
                      <Calendar size={14} className="text-gray-400" />
                      <input
                        type="date"
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                        className="input-field pl-8"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
                    <div className="form-group">
                      <User size={14} className="text-gray-400" />
                      <input
                        type="text"
                        value={apptTime}
                        onChange={(e) => setApptTime(e.target.value)}
                        className="input-field pl-8"
                        placeholder="e.g. 10:30 AM"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 🍖 PRODUCT SALE FORM */}
            {tab === 'product' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select Product / Treat</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Select a retail item...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock} {p.unit || 'pcs'} · {currencySymbol}{p.retail_price})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedProduct.stock}
                        value={productQty}
                        onChange={(e) => setProductQty(Math.max(1, Number(e.target.value) || 1))}
                        className="input-field"
                        required
                      />
                    </div>
                    <div className="flex flex-col justify-end bg-sage-muted/40 p-2.5 rounded-xl border border-sage-light/20 text-right">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Subtotal</p>
                      <p className="text-sm font-bold text-sage-dark">
                        {currencySymbol}{(selectedProduct.retail_price * productQty).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Submit */}
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
                disabled={loading}
                className="btn-sage py-2 px-5 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Adding...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add to Stay
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
