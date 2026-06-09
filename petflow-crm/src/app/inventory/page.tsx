'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Search, ShoppingBag, AlertTriangle, Package, TrendingUp, Minus, Edit2, Trash2, Filter, X, ToggleLeft, ToggleRight, History } from 'lucide-react'
import ProductModal from '@/components/ProductModal'
import CheckoutModal from '@/components/CheckoutModal'
import StockHistoryModal from '@/components/StockHistoryModal'
import { getProducts, adjustStock, deleteProduct, updateProduct, getSettings } from '@/lib/actions'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/types'
import { PRODUCT_CATEGORIES } from '@/types'

export const dynamic = 'force-dynamic'

const STOCK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_stock', label: 'In Stock' },
  { key: 'low_stock', label: '⚠️ Low' },
  { key: 'out_of_stock', label: '🚫 Out' },
] as const

type StockFilter = typeof STOCK_FILTERS[number]['key']

const categoryColors: Record<string, { bg: string; text: string }> = {
  Shampoo:     { bg: '#e0f2fe', text: '#0369a1' },
  Conditioner: { bg: '#f0fdf4', text: '#166534' },
  Treats:      { bg: '#fef3c7', text: '#92400e' },
  Accessories: { bg: '#f3e8ff', text: '#6b21a8' },
  Supplies:    { bg: '#fee2e2', text: '#991b1b' },
  Equipment:   { bg: '#e0e7ff', text: '#3730a3' },
  Other:       { bg: '#f1f5f9', text: '#475569' },
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [showModal, setShowModal] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<Product | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')

  const fmt = useCallback((n: number) => formatCurrency(n, currencyCode), [currencyCode])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const [data, settings] = await Promise.all([
        getProducts(),
        getSettings()
      ])
      setProducts(data as Product[])
      if (settings) {
        if (settings.currency_code) setCurrencyCode(settings.currency_code)
        if (settings.currency_symbol) setCurrencySymbol(settings.currency_symbol)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.sku?.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter && p.category !== categoryFilter) return false
      if (stockFilter === 'in_stock' && p.stock <= 0) return false
      if (stockFilter === 'out_of_stock' && p.stock > 0) return false
      if (stockFilter === 'low_stock' && (p.stock === 0 || p.stock > p.low_stock_threshold)) return false
      return true
    })
  }, [products, search, categoryFilter, stockFilter])

  // ── Stats ─────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: products.length,
    totalValue: products.reduce((s, p) => s + p.retail_price * p.stock, 0),
    lowStock: products.filter(p => p.stock > 0 && p.stock <= p.low_stock_threshold).length,
    outOfStock: products.filter(p => p.stock === 0).length,
  }), [products])

  const handleAdjust = async (id: string, delta: number) => {
    setAdjustingId(id)
    try {
      await adjustStock(id, delta)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
    } catch (err) {
      console.error('[adjustStock] Error:', err)
    }
    setAdjustingId(null)
  }


  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const handleToggleActive = async (p: Product) => {
    await updateProduct(p.id, { is_active: !p.is_active })
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }

  const activeFilters = (categoryFilter ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0)

  return (
    <div className="p-4 md:p-8 max-w-[1100px] pb-24 md:pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Inventory 🛍️</h1>
          <p className="text-gray-400 text-sm">Manage grooming supplies & retail products</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCheckout(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-sage-dark text-sage-dark font-800 rounded-2xl hover:bg-sage-muted/10 transition-all active:scale-95 shadow-lg shadow-sage/5"
          >
            <ShoppingBag size={20} /> Direct Sale
          </button>
          <button 
            onClick={() => { setEditProduct(null); setShowModal(true) }}
            className="flex items-center gap-2 px-6 py-3 bg-sage-dark text-white font-800 rounded-2xl hover:bg-sage-dark/90 transition-all active:scale-95 shadow-lg shadow-sage/20"
          >
            <Plus size={20} /> Add Product
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Products', value: stats.total, color: '#3b82f6', icon: Package },
          { label: 'Inventory Value', value: fmt(stats.totalValue), color: '#10b981', icon: TrendingUp, isText: true },
          { label: 'Low Stock', value: stats.lowStock, color: '#f59e0b', icon: AlertTriangle },
          { label: 'Out of Stock', value: stats.outOfStock, color: '#ef4444', icon: ShoppingBag },
        ].map((s, i) => (
          <div key={i} className="card flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${s.color}18` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 rounded-2xl"
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Filter size={13} className="text-gray-400 flex-shrink-0" />
        <div className="form-group flex-1 min-w-[160px]">
          <Search size={13} className="text-gray-400" />
          <input className="input-field pl-8 py-1.5 text-xs" placeholder="Search name or SKU..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Category */}
        <select className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none"
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Stock filter pills */}
        <div className="flex gap-1">
          {STOCK_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStockFilter(f.key)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: stockFilter === f.key ? '#1e293b' : 'white',
                color: stockFilter === f.key ? 'white' : '#64748b',
                border: '1px solid', borderColor: stockFilter === f.key ? '#1e293b' : '#e2e8f0',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {activeFilters > 0 && (
          <button onClick={() => { setCategoryFilter(''); setStockFilter('all') }}
            className="flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg text-[11px] font-bold"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <X size={11} /> Clear ({activeFilters})
          </button>
        )}
      </div>

      {/* ── Product Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card h-64 flex flex-col items-center justify-center text-gray-300 text-center">
          <Package size={48} className="mb-3 opacity-30" />
          <p className="font-semibold">No products found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const catStyle = categoryColors[p.category || 'Other'] || categoryColors.Other
            const isLow = p.stock > 0 && p.stock <= p.low_stock_threshold
            const isOut = p.stock === 0
            const margin = p.cost_price ? Math.round(((p.retail_price - p.cost_price) / p.retail_price) * 100) : null
            const busy = adjustingId === p.id

            return (
              <div key={p.id}
                className="card relative flex flex-col gap-0 overflow-hidden transition-all hover:shadow-lg"
                style={{ opacity: p.is_active ? 1 : 0.55 }}>

                {/* Stock status bar */}
                <div className="h-1 w-full absolute top-0 left-0 right-0"
                  style={{ background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }} />

                <div className="p-4 pt-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {p.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ background: catStyle.bg, color: catStyle.text }}>
                            {p.category}
                          </span>
                        )}
                        {!p.is_active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">Inactive</span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{p.name}</h3>
                      {p.sku && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{p.sku}</p>}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleToggleActive(p)} title={p.is_active ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ background: '#f8fafc', color: p.is_active ? '#10b981' : '#9ca3af' }}>
                        {p.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                      </button>
                      <button onClick={() => setEditProduct(p)}
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setSelectedHistoryProduct(p)} title="Stock History / Restock"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors">
                        <History size={13} />
                      </button>
                      <button onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Price row */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-black text-gray-800">{fmt(p.retail_price)}<span className="text-xs font-normal text-gray-400 ml-1">/{p.unit}</span></p>
                      {p.cost_price && (
                        <p className="text-[11px] text-gray-400">Cost: {fmt(p.cost_price)}</p>
                      )}
                    </div>
                    {margin !== null && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: margin >= 30 ? '#ecfdf5' : '#fffbeb', color: margin >= 30 ? '#059669' : '#d97706' }}>
                        {margin}% margin
                      </span>
                    )}
                  </div>

                  {/* Stock controls */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Stock</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-black"
                          style={{ color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#1e293b' }}>
                          {p.stock}
                        </span>
                        <span className="text-xs text-gray-400">{p.unit}</span>
                        {isLow && !isOut && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-bold border border-amber-100">LOW</span>}
                        {isOut && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold border border-red-100">OUT</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleAdjust(p.id, -1)} disabled={busy || p.stock === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all font-bold"
                        style={{ background: '#fee2e2', color: '#dc2626', opacity: (busy || p.stock === 0) ? 0.4 : 1 }}>
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-700">{p.stock}</span>
                      <button onClick={() => handleAdjust(p.id, 1)} disabled={busy}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all font-bold"
                        style={{ background: '#dcfce7', color: '#16a34a', opacity: busy ? 0.4 : 1 }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && (
        <ProductModal currencySymbol={currencySymbol} onClose={() => setShowModal(false)} onSuccess={fetchProducts} />
      )}
      {editProduct && (
        <ProductModal product={editProduct} currencySymbol={currencySymbol} onClose={() => setEditProduct(null)} onSuccess={fetchProducts} />
      )}
      {showCheckout && (
        <CheckoutModal onClose={() => setShowCheckout(false)} onSuccess={fetchProducts} />
      )}
      {selectedHistoryProduct && (
        <StockHistoryModal
          product={selectedHistoryProduct}
          currencySymbol={currencySymbol}
          currencyCode={currencyCode}
          onClose={() => setSelectedHistoryProduct(null)}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  )
}
