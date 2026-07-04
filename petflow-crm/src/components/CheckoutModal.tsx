'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Receipt, Tag, Percent, IndianRupee, Printer, CheckCircle2, Loader2, AlertCircle, ShoppingBag, Plus, Minus, Trash2, Search } from 'lucide-react'
import type { Appointment, Product, BoardingReservation } from '@/types'
import { getProducts, createInvoice, getInvoice, getSettings, getClients } from '@/lib/actions'
import { getPaymentConfig, createPaymentLink, sendPaymentLinkWhatsApp } from '@/lib/payment-actions'
import InvoiceTemplate from './InvoiceTemplate'
import type { Client } from '@/types'

interface CheckoutModalProps {
  appointment?: Appointment
  boardingReservation?: BoardingReservation
  clientId?: string
  onClose: () => void
  onSuccess: () => void
}


export default function CheckoutModal({ appointment, boardingReservation, clientId: initialClientId, onClose, onSuccess }: CheckoutModalProps) {
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat')
  const [taxRate, setTaxRate] = useState(0)
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPreset, setTipPreset] = useState<number | 'custom' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Split' | 'Online'>('Cash')
  const [cashAmount, setCashAmount] = useState(0)
  const [upiAmount, setUpiAmount] = useState(0)
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [spaSettings, setSpaSettings] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Payment Link POS states
  const [payConfig, setPayConfig] = useState<any>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<'razorpay' | 'stripe'>('razorpay')
  const [linkCopied, setLinkCopied] = useState(false)
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)

  // POS State
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<{ id: string, name: string, price: number, quantity: number }[]>([])
  
  // Client selection for direct sales
  const [clientSearch, setClientSearch] = useState('')
  const [allClients, setAllClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(
    initialClientId || appointment?.pet?.owner_id || boardingReservation?.pet?.owner_id
  )
  const [selectedClientName, setSelectedClientName] = useState<string | undefined>(
    appointment?.pet?.owner?.name || boardingReservation?.pet?.owner?.name
  )

  useEffect(() => {
    getSettings().then(s => setSpaSettings(s))
    getProducts().then(p => setAllProducts(p as any))
    getPaymentConfig().then(c => {
      setPayConfig(c)
      if (c?.default_provider) {
        setSelectedGateway(c.default_provider as 'razorpay' | 'stripe')
      }
    })
    if (!appointment && !boardingReservation) {
      getClients().then(c => setAllClients(c as any))
    }
  }, [appointment, boardingReservation])

  // Sync client when props load
  useEffect(() => {
    if (appointment) {
      setSelectedClientId(appointment.pet?.owner_id)
      setSelectedClientName(appointment.pet?.owner?.name)
    } else if (boardingReservation) {
      setSelectedClientId(boardingReservation.pet?.owner_id)
      setSelectedClientName(boardingReservation.pet?.owner?.name)
    }
  }, [appointment, boardingReservation])

  // Set initial client if provided
  useEffect(() => {
    if (initialClientId && allClients.length > 0) {
      const c = allClients.find(x => x.id === initialClientId)
      if (c) {
        setSelectedClientId(c.id)
        setSelectedClientName(c.name)
      }
    }
  }, [initialClientId, allClients])

  // ── Calculations ──────────────────────────────────────────────
  const servicesTotal = appointment 
    ? parseFloat(appointment.price?.toString() || '0') 
    : boardingReservation 
      ? parseFloat(boardingReservation.total_amount?.toString() || '0') + 
        (boardingReservation.appointments?.reduce((sum, appt) => sum + parseFloat(appt.price?.toString() || '0'), 0) || 0)
      : 0
  const productsTotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0) +
    (boardingReservation?.sales?.reduce((sum, s) => sum + parseFloat(s.total_price?.toString() || '0'), 0) || 0)
  const subtotal = servicesTotal + productsTotal

  const discountAmt = discountType === 'percent'
    ? subtotal * discount / 100
    : discount
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const taxAmount = afterDiscount * taxRate / 100
  const total = afterDiscount + taxAmount + tipAmount

  // Keep split amounts in sync with total
  useEffect(() => {
    if (paymentMethod === 'Cash') { setCashAmount(total); setUpiAmount(0) }
    if (paymentMethod === 'UPI') { setUpiAmount(total); setCashAmount(0) }
    if (paymentMethod === 'Online') { setCashAmount(0); setUpiAmount(0) }
    if (paymentMethod === 'Split') { setCashAmount(Math.ceil(total / 2)); setUpiAmount(Math.floor(total / 2)) }
  }, [paymentMethod, total])

  const splitValid = paymentMethod !== 'Split' || Math.abs((cashAmount + upiAmount) - total) < 1

  const fmt = (n: number) =>
    (spaSettings?.currency_symbol || '₹') +
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)

  // ── POS Actions ─────────────────────────────────────────────
  const addProduct = (p: Product) => {
    const existing = selectedProducts.find(x => x.id === p.id)
    if (existing) {
      setSelectedProducts(selectedProducts.map(x => x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x))
    } else {
      setSelectedProducts([...selectedProducts, { id: p.id, name: p.name, price: p.retail_price, quantity: 1 }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setSelectedProducts(selectedProducts.map(x => {
      if (x.id === id) {
        const newQty = Math.max(1, x.quantity + delta)
        return { ...x, quantity: newQty }
      }
      return x
    }))
  }

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(x => x.id !== id))
  }

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.whatsapp_number?.includes(clientSearch)
  ).slice(0, 5)

  const handleConfirm = async () => {
    if (!splitValid) { setError('Cash + UPI amounts must equal the total.'); return }
    if (paymentMethod === 'Online' && !selectedClientId) {
      setError('A registered client is required to generate online payment links.')
      return
    }
    if (!appointment && !boardingReservation && !selectedClientId) { setError('Please select a client for tracking or click "Walk-in Sale".'); return }
    
    setSaving(true)
    setError('')
    try {
      const res = await createInvoice({
        appointment_id: appointment?.id,
        boarding_reservation_id: boardingReservation?.id,
        client_id: selectedClientId,
        subtotal,
        discount,
        discount_type: discountType,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        tip_amount: tipAmount,
        total_amount: total,
        payment_method: paymentMethod,
        cash_amount: cashAmount || undefined,
        upi_amount: upiAmount || undefined,
        invoice_notes: invoiceNotes || undefined,
        status: paymentMethod === 'Online' ? 'Unpaid' : 'Paid',
        productSales: selectedProducts.map(p => ({
          productId: p.id,
          quantity: p.quantity,
          price: p.price
        }))
      })
      
      // Fetch the full invoice details for printing using invoice ID directly
      const inv = await getInvoice(res.id)
      setInvoiceData(inv)
      setShowPrint(true)
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Error creating invoice')
    }
    setSaving(false)
  }

  const handlePrint = () => {
    window.print()
  }

  // ── Print view ────────────────────────────────────────────────
  if (showPrint && invoiceData) {
    const clientWhatsapp = invoiceData.client?.whatsapp_number || 
                           invoiceData.appointment?.pet?.owner?.whatsapp_number || 
                           invoiceData.boarding_reservation?.pet?.owner?.whatsapp_number || 
                           ''

    return (
      <div className="modal-overlay" style={{ zIndex: 200 }}>
        <div style={{
          background: 'white', borderRadius: 20, width: '100%', maxWidth: 740,
          maxHeight: '95vh', overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, background: '#ecfdf5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} color="#059669" />
              </div>
              <div>
                <p style={{ fontWeight: 700, margin: 0 }}>Invoice Created!</p>
                <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0 }}>{invoiceData.invoice_number}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePrint} className="btn-sage"><Printer size={15} /> Print Invoice</button>
              <button onClick={onClose} className="btn-outline" style={{ padding: '0.5rem' }}><X size={18} /></button>
            </div>
          </div>

          {invoiceData.status === 'Unpaid' && (
            <div className="p-4 rounded-2xl border bg-amber-50/20 border-amber-100/50 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-800">
                <span className="text-sm">💳</span>
                <p className="text-xs font-bold uppercase tracking-wider">Online Payment Link Needed</p>
              </div>
              <p className="text-xs text-gray-500">
                This is a direct sale saved as unpaid. Generate a payment link to share with the client.
              </p>

              {generatedLink ? (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex gap-2">
                    <input 
                      className="input-field text-xs bg-gray-50 text-gray-500 flex-1" 
                      readOnly 
                      value={generatedLink} 
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink)
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 2000)
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-600 flex items-center gap-1.5 transition-all bg-sage-dark text-white"
                    >
                      {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {clientWhatsapp && (
                    <button 
                      onClick={async () => {
                        if (!generatedLink) return
                        setWaSending(true)
                        try {
                          await sendPaymentLinkWhatsApp(invoiceData.id, generatedLink)
                          setWaSent(true)
                          setTimeout(() => setWaSent(false), 3000)
                        } catch (err: any) {
                          alert(err.message || 'Failed to send WhatsApp message')
                        }
                        setWaSending(false)
                      }}
                      disabled={waSending}
                      className="btn-sage w-full py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 text-white"
                      style={{ background: '#25D366', borderColor: '#25D366', border: 'none', cursor: 'pointer' }}
                    >
                      {waSending ? 'Sending...' : waSent ? 'Sent Successfully! ✅' : 'Send via WhatsApp API'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {payConfig?.razorpay_enabled && payConfig?.stripe_enabled && (
                    <select 
                      value={selectedGateway} 
                      onChange={e => setSelectedGateway(e.target.value as any)}
                      className="text-xs font-bold p-2.5 rounded-xl border bg-white outline-none"
                    >
                      <option value="razorpay">Razorpay</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  )}
                  <button 
                    onClick={async () => {
                      setLinkLoading(true)
                      try {
                        const link = await createPaymentLink(invoiceData.id, selectedGateway)
                        setGeneratedLink(link.url)
                      } catch (err: any) {
                        alert(err.message || 'Error generating payment link')
                      }
                      setLinkLoading(false)
                    }}
                    disabled={linkLoading}
                    className="btn-sage py-2.5 text-xs font-bold flex-1"
                  >
                    {linkLoading ? 'Generating...' : 'Generate Payment Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          <InvoiceTemplate ref={printRef} invoice={invoiceData} spaSettings={spaSettings} />
        </div>
      </div>
    )
  }

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5)

  // ── Checkout Form ─────────────────────────────────────────────
  return (
    <div className="modal-overlay" style={{ zIndex: 200 }}>
      <div className="modal-box" style={{ maxWidth: 800, width: '90%' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sage-muted rounded-xl flex items-center justify-center">
              <Receipt size={20} className="text-sage-dark" />
            </div>
            <div>
              <h2 className="text-lg font-800 tracking-tight">Checkout Summary</h2>
              <p className="text-xs text-gray-400 font-500">
                {appointment 
                  ? `${appointment.pet?.pet_name} · ${appointment.service_type}` 
                  : boardingReservation 
                    ? `Boarding stay · ${boardingReservation.pet?.pet_name} · Room ${boardingReservation.room?.name}`
                    : 'Direct Retail Sale'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>

        {!appointment && !boardingReservation && (
          <div className="mb-6 p-4 bg-sage-muted/20 border-2 border-sage-muted rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-sage-dark" />
              <h3 className="text-sm font-800 text-sage-dark uppercase tracking-wider">Select Client for Tracking</h3>
            </div>
            
            {selectedClientId ? (
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-sage-dark/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sage-muted rounded-full flex items-center justify-center font-bold text-sage-dark">
                    {selectedClientName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-800 text-gray-800">{selectedClientName}</p>
                    <p className="text-[10px] text-gray-400 font-600">Registered Client</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedClientId(undefined); setSelectedClientName(undefined) }} className="text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl text-sm outline-none focus:border-sage-dark transition-all"
                  placeholder="Search by name or phone..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
                {clientSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-white border-2 border-gray-50 rounded-2xl shadow-2xl overflow-hidden">
                    {filteredClients.length > 0 ? (
                      filteredClients.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left p-3 hover:bg-sage-muted/10 flex items-center gap-3 border-b last:border-0"
                          onClick={() => {
                            setSelectedClientId(c.id)
                            setSelectedClientName(c.name)
                            setClientSearch('')
                          }}
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">{c.name[0]}</div>
                          <div>
                            <p className="text-sm font-700">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.whatsapp_number}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400 italic">No clients found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: POS & Products */}
          <div className="flex flex-col gap-5">
            {/* POS Section */}
            <div className="card p-4 bg-gray-50/50 border-dashed border-2">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag size={16} className="text-gray-500" />
                <h3 className="text-sm font-700 uppercase tracking-wider text-gray-500">Retail Sales</h3>
              </div>
              
              {/* Product Search */}
              <div className="relative mb-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-xl shadow-sm">
                  <Search size={14} className="text-gray-400" />
                  <input
                    type="text"
                    className="w-full outline-none text-sm"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                {productSearch && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-b last:border-0 disabled:opacity-50"
                        disabled={p.stock <= 0}
                        onClick={() => { addProduct(p); setProductSearch('') }}
                      >
                        <div>
                          <p className="font-600">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.stock} in stock</p>
                        </div>
                        <span className="font-700 text-sage-dark">{fmt(p.retail_price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Products List */}
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-xs text-gray-400 italic">No products added</p>
                  </div>
                ) : (
                  selectedProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl shadow-sm border border-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-700 text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{fmt(p.price)} per unit</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                          <button onClick={() => updateQty(p.id, -1)} className="w-5 h-5 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-500"><Minus size={10} /></button>
                          <span className="text-xs font-800 w-4 text-center">{p.quantity}</span>
                          <button onClick={() => updateQty(p.id, 1)} className="w-5 h-5 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-500"><Plus size={10} /></button>
                        </div>
                        <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-widest mb-2 block">Invoice Notes</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="Notes for the customer..."
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Billing & Payment */}
          <div className="flex flex-col gap-5">
            {/* Billing Summary */}
            <div className="card p-5 bg-white shadow-xl border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Receipt size={60} />
              </div>
              
              <div className="flex flex-col gap-3 mb-6">
                {boardingReservation && (
                  <div className="flex flex-col gap-2 p-3.5 bg-gray-50 rounded-2xl mb-2 text-xs border border-gray-100/80">
                    <p className="font-800 text-gray-400 uppercase tracking-wider text-[9px] mb-1">🏠 Boarding Stay Lodging</p>
                    <div className="flex justify-between font-bold text-gray-700">
                      <span>Room {boardingReservation.room?.name} ({boardingReservation.total_nights} nights)</span>
                      <span>{fmt(boardingReservation.total_amount)}</span>
                    </div>
                    
                    {/* Linked Spa treatments */}
                    {boardingReservation.appointments && boardingReservation.appointments.length > 0 && (
                      <>
                        <p className="font-800 text-gray-400 uppercase tracking-wider text-[9px] mt-2 mb-1">💈 Spa Add-ons</p>
                        {boardingReservation.appointments.map((appt) => (
                          <div key={appt.id} className="flex justify-between text-gray-500 font-medium">
                            <span>{appt.service_type} {appt.groomer?.name ? `(${appt.groomer.name})` : ''}</span>
                            <span>{fmt(appt.price || 0)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* Linked Product Sales */}
                    {boardingReservation.sales && boardingReservation.sales.length > 0 && (
                      <>
                        <p className="font-800 text-gray-400 uppercase tracking-wider text-[9px] mt-2 mb-1">🍖 Retail Add-ons</p>
                        {boardingReservation.sales.map((s) => (
                          <div key={s.id} className="flex justify-between text-gray-500 font-medium">
                            <span>{s.product?.name} (x{s.quantity})</span>
                            <span>{fmt(s.total_price)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
                {appointment && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-600">Service ({appointment.service_type})</span>
                    <span className="font-700">{fmt(servicesTotal)}</span>
                  </div>
                )}
                {selectedProducts.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-600">Product Purchases (POS)</span>
                    <span className="font-700">{fmt(selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0))}</span>
                  </div>
                )}
                
                {/* Discount Row */}
                <div className="flex items-center gap-3 py-2 border-y border-dashed border-gray-100">
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button onClick={() => setDiscountType('flat')} className={`px-2 py-1 text-[10px] font-800 rounded-md transition-all ${discountType === 'flat' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>{spaSettings?.currency_symbol || '₹'}</button>
                    <button onClick={() => setDiscountType('percent')} className={`px-2 py-1 text-[10px] font-800 rounded-md transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>%</button>
                  </div>
                  <input
                    type="number"
                    className="flex-1 bg-transparent text-sm font-700 outline-none placeholder-gray-300"
                    placeholder="Apply discount..."
                    value={discount || ''}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                  {discount > 0 && <span className="text-emerald-600 font-800 text-sm">-{fmt(discountAmt)}</span>}
                </div>

                {/* Tax Selector */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-700 text-gray-400 uppercase tracking-tighter">
                    {spaSettings?.tax_label || 'Tax'}
                  </span>
                  <div className="flex gap-1">
                    {(spaSettings?.tax_presets ?? [0, 5, 12, 18]).map((r: number) => (
                      <button
                        key={r}
                        onClick={() => setTaxRate(r)}
                        className={`px-2.5 py-1 text-[10px] font-800 rounded-md border transition-all ${taxRate === r ? 'bg-sage-dark border-sage-dark text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                      >
                        {r === 0 ? '0%' : `${r}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tip Section — only shows for US/tip-enabled markets */}
                {spaSettings?.tip_enabled && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-dashed border-gray-100">
                    <span className="text-xs font-700 text-gray-400 uppercase tracking-tighter">Tip 🤝</span>
                    <div className="flex gap-1">
                      {[15, 18, 20].map(pct => (
                        <button
                          key={pct}
                          onClick={() => {
                            if (tipPreset === pct) {
                              setTipPreset(null)
                              setTipAmount(0)
                            } else {
                              setTipPreset(pct)
                              setTipAmount(Math.round(afterDiscount * pct / 100 * 100) / 100)
                            }
                          }}
                          className={`px-2.5 py-1 text-[10px] font-800 rounded-md border transition-all ${
                            tipPreset === pct ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setTipPreset('custom')
                          setTipAmount(0)
                        }}
                        className={`px-2.5 py-1 text-[10px] font-800 rounded-md border transition-all ${
                          tipPreset === 'custom' ? 'bg-sage-dark border-sage-dark text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                )}
                {spaSettings?.tip_enabled && tipPreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-600">Tip amount:</span>
                    <input
                      type="number"
                      className="flex-1 bg-transparent text-sm font-700 outline-none border-b border-dashed border-gray-200 pb-0.5"
                      placeholder="Enter tip..."
                      value={tipAmount || ''}
                      onChange={e => setTipAmount(parseFloat(e.target.value) || 0)}
                    />
                    {tipAmount > 0 && <span className="text-amber-600 font-800 text-sm">+{fmt(tipAmount)}</span>}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t-2 border-gray-50">
                <span className="text-lg font-800 text-gray-800">Grand Total</span>
                <span className="text-3xl font-900 text-sage-dark tracking-tighter">{fmt(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="card p-4">
              <label className="text-[0.7rem] font-800 text-gray-400 uppercase tracking-widest mb-3 block">Payment Method</label>
              <div className="flex gap-2 mb-4">
                {(['Cash', 'UPI', 'Split', 'Online'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${paymentMethod === m ? 'border-sage-dark bg-sage-muted/30 text-sage-dark' : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-100'}`}
                  >
                    <span className="text-lg">{m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : m === 'Split' ? '💳' : '🔗'}</span>
                    <span className="text-[10px] font-900 uppercase tracking-widest">{m === 'Online' ? 'Pay Link' : m}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'Split' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl">
                  <div>
                    <label className="text-[10px] font-800 text-gray-400 uppercase mb-1 block">Cash Portion</label>
                    <input type="number" className="w-full bg-white p-2 rounded-lg text-sm font-700 outline-none border border-gray-100" value={cashAmount} onChange={e => setCashAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-800 text-gray-400 uppercase mb-1 block">UPI Portion</label>
                    <input type="number" className="w-full bg-white p-2 rounded-lg text-sm font-700 outline-none border border-gray-100" value={upiAmount} onChange={e => setUpiAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleConfirm}
              className="btn-sage w-full py-4 rounded-2xl shadow-xl shadow-sage/20 font-800 text-lg group active:scale-95 transition-all"
              disabled={saving || !splitValid}
            >
              {saving ? (
                <><Loader2 size={20} className="animate-spin" /> Finalizing...</>
              ) : (
                <>Complete Checkout <Receipt size={20} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-600">
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>
    </div>
  )
}
