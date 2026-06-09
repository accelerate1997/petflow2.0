'use client'

import { useState } from 'react'
import { X, RefreshCw, AlertCircle, ShoppingBag } from 'lucide-react'
import { processRefund } from '@/lib/actions'
import { formatCurrency } from '@/lib/currency'

interface Props {
  invoice: any
  onClose: () => void
  onSuccess: () => void
  currencyCode?: string
}

export default function RefundModal({ invoice, onClose, onSuccess, currencyCode = 'INR' }: Props) {
  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const [returnItems, setReturnItems] = useState<any[]>(
    (invoice.sales || []).map((sale: any) => ({
      saleId: sale.id,
      name: sale.product?.name || 'Unknown Product',
      sku: sale.product?.sku || 'N/A',
      quantity: sale.quantity,
      unitPrice: sale.unit_price,
      refundedQuantity: sale.refunded_quantity || 0,
      refundQty: 0,
      returnToInventory: true
    }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleQtyChange = (saleId: string, val: number) => {
    setReturnItems(items =>
      items.map(item => {
        if (item.saleId === saleId) {
          const max = item.quantity - item.refundedQuantity
          const qty = Math.max(0, Math.min(max, val))
          return { ...item, refundQty: qty }
        }
        return item
      })
    )
  }

  const handleToggleInventory = (saleId: string) => {
    setReturnItems(items =>
      items.map(item => {
        if (item.saleId === saleId) {
          return { ...item, returnToInventory: !item.returnToInventory }
        }
        return item
      })
    )
  }

  const totalRefund = returnItems.reduce((acc, item) => acc + item.refundQty * item.unitPrice, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const itemsToRefund = returnItems
      .filter(item => item.refundQty > 0)
      .map(item => ({
        saleId: item.saleId,
        quantity: item.refundQty,
        returnToInventory: item.returnToInventory
      }))

    if (itemsToRefund.length === 0) {
      setError('Please select at least 1 item to return/refund.')
      return
    }

    setLoading(true)
    try {
      await processRefund(invoice.id, itemsToRefund)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to process refund')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600">
              <RefreshCw size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base">Return & Refund Items</h2>
              <p className="text-xs text-gray-400">Invoice: {invoice.invoice_number}</p>
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
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-gray-50/50 px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
              <span>Item & SKU</span>
              <div className="flex gap-12">
                <span>Return Qty</span>
                <span>Options</span>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
              {returnItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No products found in this invoice.</p>
              ) : (
                returnItems.map(item => {
                  const available = item.quantity - item.refundedQuantity
                  return (
                    <div key={item.saleId} className="px-4 py-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          SKU: {item.sku} · Price: {fmt(item.unitPrice)}
                        </p>
                        {item.refundedQuantity > 0 && (
                          <p className="text-[10px] text-purple-600 font-semibold mt-0.5">
                            Already Refunded: {item.refundedQuantity} of {item.quantity}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-8 flex-shrink-0">
                        {/* Quantity selector */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max={available}
                            disabled={available === 0}
                            className="w-16 input-field text-center font-bold px-1"
                            value={item.refundQty}
                            onChange={e => handleQtyChange(item.saleId, parseInt(e.target.value) || 0)}
                          />
                          <span className="text-[10px] text-gray-400 font-medium">/ {available}</span>
                        </div>

                        {/* Restock checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.returnToInventory}
                            disabled={available === 0 || item.refundQty === 0}
                            onChange={() => handleToggleInventory(item.saleId)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                          />
                          <span className="text-[10px] font-bold text-gray-600">Restock</span>
                        </label>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Refund summary */}
          <div className="bg-purple-50/50 border border-purple-100/50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Estimated Refund</p>
              <p className="text-lg font-black text-purple-800">{fmt(totalRefund)}</p>
            </div>
            <div className="text-right text-[10px] text-gray-400 font-medium">
              Calculated dynamically based on unit prices of selected return quantities.
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading || totalRefund === 0}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Processing...' : 'Confirm Return & Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
