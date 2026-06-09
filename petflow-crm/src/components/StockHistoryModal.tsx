'use client'

import { useEffect, useState } from 'react'
import { X, History, Plus, AlertCircle, Calendar, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { logStockShipment, getProductStockLogs } from '@/lib/actions'
import { formatCurrency } from '@/lib/currency'
import type { Product } from '@/types'

interface Props {
  product: Product
  onClose: () => void
  onSuccess: () => void
  currencySymbol?: string
  currencyCode?: string
}

export default function StockHistoryModal({ product, onClose, onSuccess, currencySymbol = '₹', currencyCode = 'INR' }: Props) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [quantity, setQuantity] = useState('10')
  const [costPrice, setCostPrice] = useState(product.cost_price?.toString() || '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const data = await getProductStockLogs(product.id)
      setLogs(data)
    } catch (err: any) {
      console.error(err)
    }
    setLoadingLogs(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [product.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0.')
      return
    }

    setSubmitting(true)
    try {
      await logStockShipment({
        productId: product.id,
        quantity: qty,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        notes: notes || 'Replenished stock'
      })
      setNotes('')
      setQuantity('10')
      onSuccess()
      fetchLogs()
    } catch (err: any) {
      setError(err.message || 'Failed to replenish stock')
    }
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sage-muted text-sage-dark">
              <History size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base">Stock History & Restock</h2>
              <p className="text-xs text-gray-400">{product.name} (SKU: {product.sku || 'N/A'})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded-xl text-sm mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left: Restock Form */}
          <div className="md:col-span-2 border-r border-gray-100 pr-0 md:pr-6">
            <h3 className="text-xs font-800 uppercase text-gray-400 tracking-wider mb-4">Log Shipment</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Add Quantity *</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Cost Price per unit ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="e.g. 150"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Shipment Notes</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Batch #902, Vendor: PetsIndia"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-sage justify-center py-2.5 font-bold"
              >
                <Plus size={15} /> {submitting ? 'Replenishing...' : 'Replenish Stock'}
              </button>
            </form>
          </div>

          {/* Right: History Logs */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-800 uppercase text-gray-400 tracking-wider mb-4">Activity Log</h3>
            <div className="max-h-[340px] overflow-y-auto pr-1 space-y-3">
              {loadingLogs ? (
                <p className="text-xs text-gray-400 text-center py-8">Loading history...</p>
              ) : logs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No stock logs recorded yet.</p>
              ) : (
                logs.map((log) => {
                  const isAdd = log.quantity > 0
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-gray-50 bg-gray-50/50 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded font-800 text-[9px] uppercase tracking-wider ${
                            log.type === 'Replenishment' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            log.type === 'Sale' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            log.type === 'Return' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {log.type}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                            <Calendar size={11} /> {new Date(log.created).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1 font-semibold leading-tight">{log.notes || 'No description'}</p>
                        {log.cost_price && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Batch Cost: {fmt(log.cost_price)}</p>
                        )}
                      </div>
                      <div className={`font-black text-sm flex items-center flex-shrink-0 ${isAdd ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isAdd ? '+' : ''}{log.quantity}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
