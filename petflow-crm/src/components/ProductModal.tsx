'use client'

import { useState } from 'react'
import { X, Package, Tag, Hash, Layers, AlertCircle } from 'lucide-react'
import { createProduct, updateProduct } from '@/lib/actions'
import type { Product } from '@/types'
import { PRODUCT_CATEGORIES } from '@/types'

interface Props {
  product?: Product | null
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
}

const UNITS = ['pcs', 'ml', 'L', 'g', 'kg', 'pack', 'bottle', 'box']

export default function ProductModal({ product, onClose, onSuccess, currencySymbol = '₹' }: Props) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || '',
    description: product?.description || '',
    retail_price: product?.retail_price?.toString() || '',
    cost_price: product?.cost_price?.toString() || '',
    stock: product?.stock?.toString() || '0',
    low_stock_threshold: product?.low_stock_threshold?.toString() || '5',
    unit: product?.unit || 'pcs',
    is_active: product?.is_active ?? true,
    inventory_type: product?.inventory_type || 'Retail',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: string, value: string | boolean) => setForm(f => ({ ...f, [key]: value }))

  const margin = form.retail_price && form.cost_price
    ? Math.round(((parseFloat(form.retail_price) - parseFloat(form.cost_price)) / parseFloat(form.retail_price)) * 100)
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError('Product name is required'); return }
    if (!form.retail_price || isNaN(parseFloat(form.retail_price))) { setError('Retail price is required'); return }

    setLoading(true)
    setError('')
    try {
      const data = {
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
        retail_price: parseFloat(form.retail_price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
        stock: parseInt(form.stock) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        unit: form.unit,
        is_active: form.is_active,
        inventory_type: form.inventory_type,
      }
      if (isEdit) {
        await updateProduct(product.id, data)
      } else {
        await createProduct(data)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save product')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <Package size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
              <p className="text-xs text-gray-400">Inventory & Retail</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded-xl text-sm mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + SKU */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Product Name *</label>
              <div className="form-group">
                <Package size={14} className="text-gray-400" />
                <input className="input-field pl-8" placeholder="e.g. TropiClean Shampoo" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">SKU</label>
              <div className="form-group">
                <Hash size={14} className="text-gray-400" />
                <input className="input-field pl-8" placeholder="SH-001" value={form.sku} onChange={e => set('sku', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Category</label>
              <div className="form-group">
                <Tag size={14} className="text-gray-400" />
                <select className="input-field pl-8" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category</option>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Unit</label>
              <div className="form-group">
                <Layers size={14} className="text-gray-400" />
                <select className="input-field pl-8" value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Retail Price ({currencySymbol}) *</label>
              <div className="form-group">
                <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
                <input className="input-field pl-8" type="number" step="0.01" placeholder="0.00" value={form.retail_price} onChange={e => set('retail_price', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="form-label">Cost Price ({currencySymbol})</label>
              <div className="form-group">
                <span className="absolute left-3 text-xs font-semibold text-gray-400">{currencySymbol}</span>
                <input className="input-field pl-8" type="number" step="0.01" placeholder="0.00" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Margin badge */}
          {margin !== null && (
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: margin >= 30 ? '#ecfdf5' : margin >= 10 ? '#fffbeb' : '#fef2f2',
                       color: margin >= 30 ? '#059669' : margin >= 10 ? '#d97706' : '#dc2626' }}>
              Margin: {margin}% {margin >= 30 ? '✅ Healthy' : margin >= 10 ? '⚠️ Moderate' : '❌ Low'}
            </div>
          )}

          {/* Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Current Stock</label>
              <input className="input-field" type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Low Stock Alert At</label>
              <input className="input-field" type="number" min="0" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
            </div>
          </div>

          {/* Inventory Type Selector */}
          <div>
            <label className="form-label">Inventory Type</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200/50">
              <button
                type="button"
                onClick={() => set('inventory_type', 'Retail')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  form.inventory_type === 'Retail'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🛍️ Retail Product
              </button>
              <button
                type="button"
                onClick={() => set('inventory_type', 'Spa')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  form.inventory_type === 'Spa'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🛁 Spa Consumable / Supply
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea className="input-field" rows={2} placeholder="Optional notes..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Active / Available for sale</span>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className="w-11 h-6 rounded-full transition-all relative"
              style={{ background: form.is_active ? 'var(--sage)' : '#d1d5db' }}
            >
              <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all"
                style={{ transform: form.is_active ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', opacity: loading ? 0.7 : 1 }}>
              <Package size={15} />
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
