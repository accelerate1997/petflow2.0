'use client'

import { forwardRef } from 'react'
import type { Invoice, Sale, Product } from '@/types'
import { formatCurrency } from '@/lib/currency'

interface InvoiceTemplateProps {
  invoice: any
  spaSettings?: {
    spa_name: string
    spa_address: string | null
    spa_whatsapp: string | null
    spa_email: string | null
    currency_symbol: string
    currency_code?: string | null
    tax_label?: string | null
  } | null
}

const fmt = (n: number, currencyCode = 'INR') =>
  formatCurrency(n, currencyCode, { maximumFractionDigits: 2 })

const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ invoice, spaSettings }, ref) => {
    const spa = spaSettings || { spa_name: 'PetFlow Spa', spa_address: null, spa_whatsapp: null, spa_email: null, currency_symbol: '₹', currency_code: 'INR', tax_label: 'Tax' }
    const currCode = spa.currency_code || 'INR'
    
    // Extract info based on if it's an appointment, boarding stay, or direct sale
    const appt = invoice.appointment
    const boarding = invoice.boarding_reservation
    const client = invoice.client || appt?.pet.owner || boarding?.pet.owner
    const ownerName = client?.name || 'Walk-in Customer'
    const petName = appt?.pet.pet_name || boarding?.pet.pet_name
    
    const discountDisplay = invoice.discount_type === 'percent'
      ? `${invoice.discount}%`
      : fmt(invoice.discount, currCode)

    const paidLinks = invoice.payment_links?.filter((l: any) => l.status === 'paid') || []
    const totalPaid = paidLinks.reduce((sum: number, l: any) => sum + l.amount, 0)
    const remainingBalance = Math.max(0, invoice.total_amount - totalPaid)

    return (
      <>
        <style>{`
          @media print {
            @page { 
              size: A4; 
              margin: 1.5cm; 
            }
            
            /* RESET ALL STYLES */
            body * {
              visibility: hidden !important;
              display: none !important;
            }

            /* FORCE SHOW THE INVOICE AND ITS ENTIRE PARENT CHAIN */
            html, body, 
            #invoice-print-root, 
            #invoice-print-root *,
            .modal-overlay,
            .modal-box,
            main,
            div {
              visibility: visible !important;
              display: block !important;
              position: static !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              width: auto !important;
              max-width: none !important;
              max-height: none !important;
              box-shadow: none !important;
              transform: none !important;
              background: none !important;
              overflow: visible !important;
            }

            /* THE INVOICE ITSELF */
            #invoice-print-root {
              visibility: visible !important;
              display: block !important;
              width: 100% !important;
              background: #fff !important;
              padding: 0 !important;
              position: relative !important;
            }

            .no-print { display: none !important; }
            
            /* Background Colors for Print */
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}</style>

        <div
          id="invoice-print-root"
          ref={ref}
          style={{
            fontFamily: "'Inter', sans-serif",
            maxWidth: '800px',
            margin: '0 auto',
            color: '#1e293b',
            background: '#fff',
            padding: '40px',
            position: 'relative',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          {/* Header Accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: '#89A894', borderRadius: '12px 12px 0 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px', marginTop: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '44px', height: '44px', background: '#f0fdf4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '1px solid #dcfce7' }}>🐾</div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#1e293b', letterSpacing: '-0.03em' }}>{spa.spa_name}</h1>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>{spa.spa_address || 'Pet Grooming & Spa Services'}</p>
                {spa.spa_whatsapp && <p style={{ margin: '2px 0' }}>WhatsApp: {spa.spa_whatsapp}</p>}
                {spa.spa_email && <p style={{ margin: 0 }}>{spa.spa_email}</p>}
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', margin: '0 0 4px 0' }}>Invoice</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#1e293b' }}>#{invoice.invoice_number}</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px', fontWeight: 500 }}>
                Date: {new Date(invoice.created).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '48px', padding: '24px', background: '#f8fafc', borderRadius: '16px' }}>
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '12px' }}>Client Info</p>
              <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px 0', color: '#1e293b' }}>{ownerName}</p>
              {client?.whatsapp_number && <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{client.whatsapp_number}</p>}
              {client?.email && <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{client.email}</p>}
            </div>
            {petName && (
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: '12px' }}>Pet Details</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{speciesEmoji[appt?.pet.species || boarding?.pet.species || 'other']}</span>
                  <div>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>{petName}</p>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{appt?.pet.breed || boarding?.pet.breed || 'Pet'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Item Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Qty</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Service Row */}
              {appt && (
                <tr>
                  <td style={{ padding: '20px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{appt.service_type}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Spa & Grooming Service</p>
                    {appt.groomer && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Groomer: {appt.groomer.name}</p>}
                  </td>
                  <td style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#475569' }}>
                    1
                  </td>
                  <td style={{ padding: '20px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                    {fmt(appt.price || 0, currCode)}
                  </td>
                </tr>
              )}
              {/* Boarding Row */}
              {boarding && (
                <tr>
                  <td style={{ padding: '20px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Boarding Stay ({boarding.room?.name})</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                      Room Type: {boarding.room?.room_type} · Stay: {boarding.check_in_date} to {boarding.check_out_date}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' }}>Nights: {boarding.total_nights} · Rate: {fmt(boarding.room?.price_per_night || 0, currCode)}/night</p>
                  </td>
                  <td style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#475569' }}>
                    {boarding.total_nights}
                  </td>
                  <td style={{ padding: '20px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                    {fmt(boarding.total_amount || 0, currCode)}
                  </td>
                </tr>
              )}
              {/* Boarding Linked Spa Treatment Rows */}
              {boarding && boarding.appointments?.map((appt: any) => (
                <tr key={appt.id}>
                  <td style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>💈 Spa Add-on: {appt.service_type}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Groomer: {appt.groomer?.name || 'Staff'}</p>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#475569' }}>
                    1
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                    {fmt(appt.price || 0, currCode)}
                  </td>
                </tr>
              ))}
              {/* Product Rows */}
              {invoice.sales?.map((sale: any) => (
                <tr key={sale.id}>
                  <td style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{sale.product?.name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Retail Product · {sale.product?.sku || 'N/A'}</p>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem', color: '#475569' }}>
                    {sale.quantity}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                    {fmt(sale.total_price, currCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '48px' }}>
            <div style={{ width: '280px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#64748b' }}>
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal, currCode)}</span>
              </div>
              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#059669' }}>
                  <span>Discount ({discountDisplay})</span>
                  <span>-{fmt(invoice.discount_type === 'percent' ? invoice.subtotal * invoice.discount / 100 : invoice.discount, currCode)}</span>
                </div>
              )}
              {invoice.tax_rate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#64748b' }}>
                  <span>{spa.tax_label || 'Tax'} ({invoice.tax_rate}%)</span>
                  <span>{fmt(invoice.tax_amount, currCode)}</span>
                </div>
              )}
              <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Total Amount</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>{fmt(invoice.total_amount, currCode)}</span>
              </div>
              {invoice.status === 'Partially Paid' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.9rem', color: '#166534' }}>
                    <span>Deposit Paid</span>
                    <span>{fmt(totalPaid, currCode)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.9rem', color: '#b91c1c', fontWeight: 700 }}>
                    <span>Remaining Balance</span>
                    <span>{fmt(remainingBalance, currCode)}</span>
                  </div>
                </>
              )}
              {invoice.status === 'Partially Paid' ? (
                <div style={{ marginTop: '16px', padding: '10px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', textAlign: 'right' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', margin: 0, textTransform: 'uppercase' }}>
                    Partially Paid via {invoice.payment_method}
                  </p>
                </div>
              ) : invoice.status === 'Unpaid' ? (
                <div style={{ marginTop: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', textAlign: 'right' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', margin: 0, textTransform: 'uppercase' }}>
                    Unpaid
                  </p>
                </div>
              ) : invoice.status === 'Refunded' ? (
                <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '8px', textAlign: 'right' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', margin: 0, textTransform: 'uppercase' }}>
                    Refunded
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'right' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', margin: 0, textTransform: 'uppercase' }}>
                    Paid via {invoice.payment_method}
                  </p>
                </div>
              )}
            </div>
          </div>

          {invoice.invoice_notes && (
            <div style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '12px', marginBottom: '48px' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Notes</p>
              <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>{invoice.invoice_notes}</p>
            </div>
          )}

          <div style={{ textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '32px' }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Thank you for visiting! 🐾</p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>We look forward to seeing you and your pet again.</p>
          </div>
        </div>
      </>
    )
  }
)

InvoiceTemplate.displayName = 'InvoiceTemplate'
export default InvoiceTemplate
