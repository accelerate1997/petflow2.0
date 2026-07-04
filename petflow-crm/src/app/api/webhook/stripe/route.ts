import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { apiRateLimiter } from '@/lib/rate-limiter'
import { decrypt } from '@/lib/encryption'

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
        status: 'Paid',
        payment_method: 'Online (Stripe)',
      },
    })

    // Update linked Appointment or BoardingReservation
    const invoiceRecord = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (invoiceRecord?.appointment_id) {
      await prisma.appointment.update({
        where: { id: invoiceRecord.appointment_id },
        data: { payment_status: 'Online' },
      })
    }

    if (invoiceRecord?.boarding_reservation_id) {
      await prisma.boardingReservation.update({
        where: { id: invoiceRecord.boarding_reservation_id },
        data: {
          payment_status: 'Online',
          payment_method: 'Online (Stripe)',
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}
