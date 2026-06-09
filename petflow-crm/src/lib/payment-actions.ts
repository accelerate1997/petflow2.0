'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentTenantId } from './session-utils'
import Razorpay from 'razorpay'
import Stripe from 'stripe'
import { sendWhatsApp } from './whatsapp'
import { encrypt, decrypt } from './encryption'

// ─── Payment Config ───────────────────────────────────────────────────────────

export async function getPaymentConfig() {
  const tenantId = await getCurrentTenantId()
  const config = await prisma.paymentConfig.findFirst({ where: { tenantId } })
  if (!config) return null
  
  return {
    ...config,
    stripe_secret_key: decrypt(config.stripe_secret_key),
    stripe_webhook_secret: decrypt(config.stripe_webhook_secret),
    razorpay_key_secret: decrypt(config.razorpay_key_secret),
    razorpay_webhook_secret: decrypt(config.razorpay_webhook_secret)
  }
}

export async function updatePaymentConfig(data: {
  razorpay_enabled?: boolean
  razorpay_key_id?: string | null
  razorpay_key_secret?: string | null
  razorpay_webhook_secret?: string | null
  stripe_enabled?: boolean
  stripe_secret_key?: string | null
  stripe_webhook_secret?: string | null
  stripe_publishable_key?: string | null
  default_provider?: string
}) {
  const tenantId = await getCurrentTenantId()
  
  const encryptedData = {
    ...data,
    stripe_secret_key: encrypt(data.stripe_secret_key),
    stripe_webhook_secret: encrypt(data.stripe_webhook_secret),
    razorpay_key_secret: encrypt(data.razorpay_key_secret),
    razorpay_webhook_secret: encrypt(data.razorpay_webhook_secret)
  }

  const existing = await prisma.paymentConfig.findFirst({ where: { tenantId } })

  if (existing) {
    await prisma.paymentConfig.update({
      where: { id: existing.id },
      data: { ...encryptedData, tenantId },
    })
  } else {
    await prisma.paymentConfig.create({
      data: { ...encryptedData, tenantId },
    })
  }

  revalidatePath('/settings')
}

// ─── Payment Links ────────────────────────────────────────────────────────────

export async function createPaymentLink(
  invoiceId: string,
  provider?: 'razorpay' | 'stripe'
) {
  const tenantId = await getCurrentTenantId()
  const settings = await prisma.settings.findFirst({ where: { tenantId } })
  const currencyCode = (settings?.currency_code || 'INR').toUpperCase()
  const config = await getPaymentConfig()
  if (!config) throw new Error('Payment gateway not configured')

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      client: true,
      appointment: { include: { pet: { include: { owner: true } } } },
      boarding_reservation: { include: { pet: { include: { owner: true } } } },
    },
  })
  if (!invoice) throw new Error('Invoice not found')

  // Determine client info
  let clientName = 'Customer'
  let clientEmail = ''
  let clientPhone = ''

  if (invoice.client) {
    clientName = invoice.client.name
    clientEmail = invoice.client.email || ''
    clientPhone = invoice.client.whatsapp_number || ''
  } else if (invoice.appointment?.pet?.owner) {
    const owner = invoice.appointment.pet.owner
    clientName = owner.name
    clientEmail = owner.email || ''
    clientPhone = owner.whatsapp_number || ''
  } else if (invoice.boarding_reservation?.pet?.owner) {
    const owner = invoice.boarding_reservation.pet.owner
    clientName = owner.name
    clientEmail = owner.email || ''
    clientPhone = owner.whatsapp_number || ''
  }

  // Determine provider
  const selectedProvider = provider || (config.default_provider as 'razorpay' | 'stripe')

  let providerLinkId = ''
  let url = ''

  if (selectedProvider === 'razorpay') {
    if (!config.razorpay_enabled || !config.razorpay_key_id || !config.razorpay_key_secret) {
      throw new Error('Razorpay is not configured')
    }

    const rz = new Razorpay({
      key_id: config.razorpay_key_id,
      key_secret: config.razorpay_key_secret,
    })

    const link = await rz.paymentLink.create({
      amount: Math.round(invoice.total_amount * 100), // paise/cents
      currency: currencyCode,
      reference_id: invoice.id,
      description: `Payment for Invoice #${invoice.invoice_number}`,
      customer: {
        name: clientName,
        email: clientEmail,
        contact: clientPhone,
      },
      notify: { sms: false, email: false },
      notes: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
    })

    providerLinkId = link.id
    url = link.short_url
  } else if (selectedProvider === 'stripe') {
    if (!config.stripe_enabled || !config.stripe_secret_key) {
      throw new Error('Stripe is not configured')
    }

    const stripe = new Stripe(config.stripe_secret_key)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment' as const,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currencyCode.toLowerCase(),
            unit_amount: Math.round(invoice.total_amount * 100),
            product_data: {
              name: `Invoice #${invoice.invoice_number}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/cancelled`,
    })

    providerLinkId = session.id
    url = session.url || ''
  } else {
    throw new Error(`Unsupported payment provider: ${selectedProvider}`)
  }

  const paymentLink = await prisma.paymentLink.create({
    data: {
      tenantId,
      invoice_id: invoiceId,
      provider: selectedProvider,
      provider_link_id: providerLinkId,
      url,
      amount: invoice.total_amount,
      currency: currencyCode,
      status: 'created',
    },
  })

  revalidatePath('/billing')
  return paymentLink
}

export async function getPaymentLinks(invoiceId?: string) {
  const tenantId = await getCurrentTenantId()
  return await prisma.paymentLink.findMany({
    where: invoiceId ? { invoice_id: invoiceId, tenantId } : { tenantId },
    orderBy: { created: 'desc' },
    include: { invoice: true },
  })
}

export async function cancelPaymentLink(linkId: string) {
  const tenantId = await getCurrentTenantId()
  const existing = await prisma.paymentLink.findFirst({
    where: { id: linkId, tenantId }
  })
  if (!existing) throw new Error('Payment link not found')

  await prisma.paymentLink.update({
    where: { id: linkId },
    data: { status: 'cancelled' },
  })
  revalidatePath('/billing')
}

export async function sendPaymentLinkWhatsApp(invoiceId: string, url: string) {
  const tenantId = await getCurrentTenantId()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      client: true,
      appointment: { include: { pet: { include: { owner: true } } } },
      boarding_reservation: { include: { pet: { include: { owner: true } } } },
    },
  })
  if (!invoice) throw new Error('Invoice not found')

  let clientPhone = ''
  let clientName = 'Valued Client'

  if (invoice.client) {
    clientName = invoice.client.name
    clientPhone = invoice.client.whatsapp_number || ''
  } else if (invoice.appointment?.pet?.owner) {
    const owner = invoice.appointment.pet.owner
    clientName = owner.name
    clientPhone = owner.whatsapp_number || ''
  } else if (invoice.boarding_reservation?.pet?.owner) {
    const owner = invoice.boarding_reservation.pet.owner
    clientName = owner.name
    clientPhone = owner.whatsapp_number || ''
  }

  if (!clientPhone) {
    throw new Error('Client phone number not found')
  }

  const settings = await prisma.settings.findFirst({ where: { tenantId } })
  const spaName = settings?.spa_name || 'PetFlow Spa'

  const message = `🐾 *Payment Request* 🧾\n\nHi ${clientName},\n\nYour payment link for *Invoice #${invoice.invoice_number}* (Total: ${settings?.currency_symbol || '₹'}${invoice.total_amount}) is ready.\n\nPlease complete your payment securely online using this link:\n🔗 ${url}\n\nThank you for choosing *${spaName}*! ✨`

  await sendWhatsApp(clientPhone, message)
  return { success: true }
}
