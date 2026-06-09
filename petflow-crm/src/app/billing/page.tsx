'use client'

import { useEffect, useState } from 'react'
import { Receipt, Search, FileText, Download, Filter, IndianRupee, Printer, X, Calendar, User, RefreshCw, Link2, Copy, Check, CreditCard, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { getInvoices, getSettings } from '@/lib/actions'
import { createPaymentLink, getPaymentConfig, getPaymentLinks, sendPaymentLinkWhatsApp } from '@/lib/payment-actions'
import InvoiceTemplate from '@/components/InvoiceTemplate'
import RefundModal from '@/components/RefundModal'

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [spaSettings, setSpaSettings] = useState<any>(null)

  const [refundingInvoice, setRefundingInvoice] = useState<any>(null)

  // Payment link state
  const [paymentEnabled, setPaymentEnabled] = useState(false)
  const [paymentProviders, setPaymentProviders] = useState<{ razorpay: boolean; stripe: boolean; default: string }>({ razorpay: false, stripe: false, default: 'razorpay' })
  const [payLinkModal, setPayLinkModal] = useState<any>(null)
  const [payLinkProvider, setPayLinkProvider] = useState<'razorpay' | 'stripe'>('razorpay')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [payLinkError, setPayLinkError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [existingLinks, setExistingLinks] = useState<Record<string, any[]>>({})
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)

  const refreshData = () => {
    setLoading(true)
    Promise.all([getInvoices(), getSettings(), getPaymentConfig(), getPaymentLinks()]).then(([invs, settings, payConfig, links]) => {
      setInvoices(invs)
      setSpaSettings(settings)
      if (payConfig) {
        setPaymentEnabled(payConfig.razorpay_enabled || payConfig.stripe_enabled)
        setPaymentProviders({
          razorpay: payConfig.razorpay_enabled,
          stripe: payConfig.stripe_enabled,
          default: payConfig.default_provider,
        })
        setPayLinkProvider(payConfig.default_provider as any)
      }
      // Group links by invoice_id
      const linkMap: Record<string, any[]> = {}
      links.forEach((l: any) => {
        if (!linkMap[l.invoice_id]) linkMap[l.invoice_id] = []
        linkMap[l.invoice_id].push(l)
      })
      setExistingLinks(linkMap)
      setLoading(false)
    })
  }

  useEffect(() => {
    refreshData()
  }, [])

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.appointment?.pet?.pet_name?.toLowerCase().includes(q) ||
      inv.appointment?.pet?.owner?.name?.toLowerCase().includes(q) ||
      inv.boarding_reservation?.pet?.pet_name?.toLowerCase().includes(q) ||
      inv.boarding_reservation?.pet?.owner?.name?.toLowerCase().includes(q) ||
      inv.client?.name?.toLowerCase().includes(q)
    )
  })

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: spaSettings?.currency_code || 'INR' }).format(n)
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
    }
  }

  const openPayLinkModal = (inv: any) => {
    setPayLinkModal(inv)
    setGeneratedLink('')
    setPayLinkError('')
    setCopiedLink(false)
    setPayLinkProvider(paymentProviders.default as any)
  }

  const handleGenerateLink = async () => {
    if (!payLinkModal) return
    setGeneratingLink(true)
    setPayLinkError('')
    try {
      const link = await createPaymentLink(payLinkModal.id, payLinkProvider)
      setGeneratedLink(link.url)
      refreshData()
    } catch (err: any) {
      setPayLinkError(err.message || 'Failed to create payment link.')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSendWhatsApp = async (inv: any) => {
    setSendingWhatsApp(true)
    try {
      await sendPaymentLinkWhatsApp(inv.id, generatedLink)
      setWhatsappSent(true)
      setTimeout(() => setWhatsappSent(false), 3000)
    } catch (err: any) {
      alert(err.message || 'Failed to send WhatsApp message')
    }
    setSendingWhatsApp(false)
  }

  const getPaymentStatus = (inv: any) => {
    const links = existingLinks[inv.id] || []
    const paidLink = links.find((l: any) => l.status === 'paid')
    const pendingLink = links.find((l: any) => l.status === 'created')
    if (paidLink) return 'paid'
    if (pendingLink) return 'pending'
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Billing & Invoices 🧾</h1>
          <p className="text-gray-400 text-sm">View and manage all service transactions</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search invoice or client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full md:w-64 pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: fmt(invoices.reduce((s, i) => s + i.total_amount, 0)), color: '#10b981' },
          { label: 'Invoices', value: invoices.length, color: '#3b82f6' },
          { label: 'This Month', value: fmt(invoices.filter(i => new Date(i.created).getMonth() === new Date().getMonth()).reduce((s, i) => s + i.total_amount, 0)), color: '#8b5cf6' },
          { label: 'Online Payments', value: invoices.filter(i => i.payment_method?.includes('Online')).length, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="card p-4">
            <p className="text-[0.65rem] font-700 text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-lg font-800" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Invoice List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider">Client & Pet</th>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider">Date</th>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-[0.7rem] font-800 text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    <td colSpan={6} className="p-8"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-600">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const linkStatus = getPaymentStatus(inv)
                  return (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        <span className="text-[0.8rem] font-800 text-gray-800">{inv.invoice_number}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-sage-muted flex items-center justify-center text-sm">
                            {inv.appointment 
                              ? (inv.appointment.pet?.species === 'dog' ? '🐕' : '🐈') 
                              : inv.boarding_reservation
                                ? (inv.boarding_reservation.pet?.species === 'dog' ? '🐕' : '🐈')
                                : '🛍️'}
                          </div>
                          <div>
                            <p className="text-[0.8rem] font-700 text-gray-800">
                              {inv.appointment?.pet?.pet_name 
                                || inv.boarding_reservation?.pet?.pet_name 
                                || 'Retail Sale'}
                            </p>
                            <p className="text-[0.65rem] text-gray-500">
                              {inv.appointment?.pet?.owner?.name 
                                || inv.boarding_reservation?.pet?.owner?.name 
                                || inv.client?.name 
                                || 'Walk-in Customer'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-[0.75rem] font-600 text-gray-600">
                          {new Date(inv.created).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-[0.85rem] font-800 text-gray-900">{fmt(inv.total_amount)}</p>
                        <p className="text-[0.6rem] font-700 text-sage-dark uppercase opacity-60">{inv.payment_method}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-800 uppercase inline-block w-fit ${
                            inv.status === 'Refunded' ? 'bg-red-50 text-red-600 border border-red-100' :
                            inv.status === 'Partially Refunded' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                            inv.status === 'Void' ? 'bg-gray-50 text-gray-600 border border-gray-100' :
                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {inv.status || 'Paid'}
                          </span>
                          {linkStatus === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full text-[0.55rem] font-700 uppercase bg-amber-50 text-amber-600 border border-amber-100 inline-block w-fit">
                              Link Sent
                            </span>
                          )}
                          {linkStatus === 'paid' && (
                            <span className="px-2 py-0.5 rounded-full text-[0.55rem] font-700 uppercase bg-blue-50 text-blue-600 border border-blue-100 inline-block w-fit">
                              Paid Online
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {paymentEnabled && inv.status !== 'Paid' && inv.status !== 'Refunded' && !linkStatus && (
                            <button
                              onClick={() => openPayLinkModal(inv)}
                              className="p-2 rounded-lg text-xs font-600 flex items-center gap-1 transition-all"
                              style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}
                              title="Send Payment Link"
                            >
                              <Link2 size={14} />
                              <span className="hidden md:inline">Pay Link</span>
                            </button>
                          )}
                          {paymentEnabled && linkStatus === 'pending' && (
                            <button
                              onClick={() => {
                                const links = existingLinks[inv.id] || []
                                const pendingLink = links.find((l: any) => l.status === 'created')
                                if (pendingLink) {
                                  setPayLinkModal(inv)
                                  setGeneratedLink(pendingLink.url)
                                }
                              }}
                              className="p-2 rounded-lg text-xs font-600 flex items-center gap-1 transition-all"
                              style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}
                              title="View Payment Link"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 740, maxHeight: '95vh', overflow: 'auto' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: '#ecfdf5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={20} color="#059669" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>Invoice Details</p>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>{selectedInvoice.invoice_number}</p>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {selectedInvoice.sales && selectedInvoice.sales.length > 0 && selectedInvoice.status !== 'Refunded' && (
                    <button onClick={() => setRefundingInvoice(selectedInvoice)} className="p-2 py-1 px-3 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1 transition-all">
                      <RefreshCw size={13} /> Return / Refund
                    </button>
                  )}
                  <button onClick={() => window.print()} className="btn-sage">
                    <Printer size={15} /> Print
                  </button>
                  <button onClick={() => setSelectedInvoice(null)} className="btn-outline" style={{ padding: '0.5rem' }}>
                    <X size={18} />
                  </button>
                </div>
             </div>
             <InvoiceTemplate invoice={selectedInvoice} spaSettings={spaSettings} />
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundingInvoice && (
        <RefundModal
          invoice={refundingInvoice}
          currencyCode={spaSettings?.currency_code || 'INR'}
          onClose={() => {
            setRefundingInvoice(null)
            setSelectedInvoice(null)
          }}
          onSuccess={refreshData}
        />
      )}

      {/* ─── Payment Link Modal ────────────────────────────────────────────── */}
      {payLinkModal && (
        <div className="modal-overlay" onClick={() => setPayLinkModal(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.1)' }}>
                  <CreditCard size={18} style={{ color: '#6366f1' }} />
                </div>
                <div>
                  <h3 className="font-700 text-gray-900" style={{ fontSize: '0.95rem' }}>Payment Link</h3>
                  <p className="text-xs text-gray-400">Invoice {payLinkModal.invoice_number} · {fmt(payLinkModal.total_amount)}</p>
                </div>
              </div>
              <button onClick={() => setPayLinkModal(null)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {!generatedLink ? (
                <div className="flex flex-col gap-4">
                  {/* Provider Selection */}
                  <div>
                    <label className="text-sm font-600 text-gray-700 block mb-2">Payment Provider</label>
                    <div className="flex gap-3">
                      {paymentProviders.razorpay && (
                        <button
                          onClick={() => setPayLinkProvider('razorpay')}
                          className="flex-1 p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all"
                          style={{
                            borderColor: payLinkProvider === 'razorpay' ? '#2563eb' : '#e5e7eb',
                            background: payLinkProvider === 'razorpay' ? 'rgba(37,99,235,0.04)' : 'white',
                          }}
                        >
                          <CreditCard size={20} color="#2563eb" />
                          <span className="text-xs font-700" style={{ color: payLinkProvider === 'razorpay' ? '#2563eb' : '#6b7280' }}>Razorpay</span>
                          <span className="text-[9px] text-gray-400">UPI, Cards, Wallets</span>
                        </button>
                      )}
                      {paymentProviders.stripe && (
                        <button
                          onClick={() => setPayLinkProvider('stripe')}
                          className="flex-1 p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all"
                          style={{
                            borderColor: payLinkProvider === 'stripe' ? '#6366f1' : '#e5e7eb',
                            background: payLinkProvider === 'stripe' ? 'rgba(99,102,241,0.04)' : 'white',
                          }}
                        >
                          <CreditCard size={20} color="#6366f1" />
                          <span className="text-xs font-700" style={{ color: payLinkProvider === 'stripe' ? '#6366f1' : '#6b7280' }}>Stripe</span>
                          <span className="text-[9px] text-gray-400">Cards, Apple Pay</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Invoice Summary */}
                  <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Client</span>
                      <span className="font-600 text-gray-800">
                        {payLinkModal.appointment?.pet?.owner?.name || payLinkModal.boarding_reservation?.pet?.owner?.name || payLinkModal.client?.name || 'Walk-in'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-800 text-gray-900">{fmt(payLinkModal.total_amount)}</span>
                    </div>
                  </div>

                  {payLinkError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                      <X size={14} /> {payLinkError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button className="btn-outline flex-1" onClick={() => setPayLinkModal(null)}>Cancel</button>
                    <button className="btn-sage flex-1" onClick={handleGenerateLink} disabled={generatingLink}>
                      {generatingLink ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Link2 size={15} /> Generate Link</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Success */}
                  <div className="flex flex-col items-center gap-3 py-3 text-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <CheckCircle2 size={28} style={{ color: '#10b981' }} />
                    </div>
                    <p className="font-700 text-gray-900">Payment Link Ready!</p>
                    <p className="text-xs text-gray-400">Share this link with your client</p>
                  </div>

                  {/* Link display */}
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 flex-1 truncate font-mono">{generatedLink}</span>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-600 flex-shrink-0 transition-all"
                      style={{
                        background: copiedLink ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color: copiedLink ? '#059669' : '#6366f1',
                      }}
                    >
                      {copiedLink ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-1">
                    <button className="btn-outline flex-1" onClick={() => setPayLinkModal(null)}>Done</button>
                    <button
                      className="flex-1 py-2.5 rounded-xl text-sm font-700 flex items-center justify-center gap-2 transition-all disabled:opacity-75"
                      style={{ background: '#25D366', color: 'white', border: 'none', cursor: 'pointer' }}
                      onClick={() => handleSendWhatsApp(payLinkModal)}
                      disabled={sendingWhatsApp}
                    >
                      {sendingWhatsApp ? (
                        <>⌛ Sending...</>
                      ) : whatsappSent ? (
                        <>✅ Sent Successfully</>
                      ) : (
                        <>📱 Send via WhatsApp</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
