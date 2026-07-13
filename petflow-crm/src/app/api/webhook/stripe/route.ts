import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { apiRateLimiter } from '@/lib/rate-limiter'
import { decrypt } from '@/lib/encryption'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1'
  const { allowed, limit, remaining, reset } = apiRateLimiter.limit(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(reset / 1000).toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil((Date.now() + reset) / 1000).toString(),
        }
      }
    )
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature') || ''

  let unverifiedEvent
  try {
    unverifiedEvent = JSON.parse(body)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionObj = unverifiedEvent.data?.object
  const invoiceId = sessionObj?.metadata?.invoice_id

  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice ID not found in metadata' }, { status: 400 })
  }

  // Load the invoice to find its tenantId
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true }
  })

  if (!invoice || !invoice.tenantId) {
    return NextResponse.json({ error: 'Invoice or Tenant not found' }, { status: 400 })
  }

  // Load the tenant's PaymentConfig
  const config = await prisma.paymentConfig.findFirst({
    where: { tenantId: invoice.tenantId }
  })

  if (!config) {
    return NextResponse.json({ error: 'Stripe not configured for this tenant' }, { status: 500 })
  }

  const decryptedSecretKey = decrypt(config.stripe_secret_key)
  const decryptedWebhookSecret = decrypt(config.stripe_webhook_secret)

  if (!decryptedSecretKey || !decryptedWebhookSecret) {
    return NextResponse.json({ error: 'Stripe keys are missing or invalid' }, { status: 500 })
  }

  const stripe = new Stripe(decryptedSecretKey)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      decryptedWebhookSecret
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const stripePaymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : (session.payment_intent && 'id' in session.payment_intent ? session.payment_intent.id : null)

    const pendingLink = await prisma.paymentLink.findFirst({
      where: {
        invoice_id: invoiceId,
        provider: 'stripe',
        status: 'created',
      },
    })

    const invoiceRecord = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    const isPartial = pendingLink && invoiceRecord && pendingLink.amount < invoiceRecord.total_amount
    const targetStatus = isPartial ? 'Partially Paid' : 'Paid'

    // Update PaymentLink record
    await prisma.paymentLink.updateMany({
      where: {
        invoice_id: invoiceId,
        provider: 'stripe',
        status: 'created',
      },
      data: {
        status: 'paid',
        paid_at: new Date(),
        provider_payment_id: stripePaymentIntentId,
      },
    })

    // Update Invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: targetStatus,
        payment_method: 'Online (Stripe)',
      },
    })

    if (invoiceRecord?.appointment_id) {
      const appt = await prisma.appointment.findUnique({
        where: { id: invoiceRecord.appointment_id }
      })
      const nextApptStatus = appt?.status === 'PendingPayment' ? 'Booked' : appt?.status

      await prisma.appointment.update({
        where: { id: invoiceRecord.appointment_id },
        data: { 
          payment_status: isPartial ? 'Partially Paid' : 'Online',
          status: nextApptStatus
        },
      })
    }

    if (invoiceRecord?.boarding_reservation_id) {
      await prisma.boardingReservation.update({
        where: { id: invoiceRecord.boarding_reservation_id },
        data: {
          payment_status: isPartial ? 'Partially Paid' : 'Online',
          payment_method: 'Online (Stripe)',
        },
      })
    }

    // Send WhatsApp confirmation
    try {
      const fullInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          appointment: {
            include: {
              pet: true
            }
          },
          boarding_reservation: {
            include: {
              pet: true
            }
          }
        }
      })

      const clientPhone = fullInvoice?.client?.whatsapp_number
      const clientName = fullInvoice?.client?.name

      if (clientPhone && clientName) {
        const petName = fullInvoice.appointment?.pet?.pet_name || fullInvoice.boarding_reservation?.pet?.pet_name || 'your pet'
        const serviceName = fullInvoice.appointment?.service_type || 'Boarding Reservation'
        
        let confirmMsg = ''
        if (isPartial) {
          const paidAmount = pendingLink ? pendingLink.amount : 0
          const formattedPaid = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paidAmount)
          confirmMsg = `*Booking Confirmed!* 🐾\n\nHi ${clientName}, we have received your deposit of ${formattedPaid} for ${petName}'s ${serviceName} booking.\n\nYour slot is secured! See you soon. 😊`
        } else {
          const totalAmount = fullInvoice.total_amount
          const formattedTotal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)
          confirmMsg = `*Payment Received!* 🐾\n\nHi ${clientName}, we have received your payment of ${formattedTotal} for ${petName}'s ${serviceName} booking.\n\nThank you, and we look forward to seeing you! 😊`
        }

        await sendWhatsApp(clientPhone, confirmMsg, invoice.tenantId || undefined)
        console.log(`[PAYMENT CONFIRMATION] Sent to ${clientPhone}`)
      }
    } catch (whErr) {
      console.error('[PAYMENT CONFIRMATION ERROR]:', whErr)
    }
  }

  return NextResponse.json({ received: true })
}
