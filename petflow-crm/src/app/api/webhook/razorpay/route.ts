import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
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
  const signature = req.headers.get('x-razorpay-signature') || ''

  let event
  try {
    event = JSON.parse(body)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const paymentLinkEntity = event.payload?.payment_link?.entity
  const invoiceId = paymentLinkEntity?.reference_id || paymentLinkEntity?.notes?.invoice_id

  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice ID not found in payload' }, { status: 400 })
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
    return NextResponse.json({ error: 'Webhook not configured for this tenant' }, { status: 500 })
  }

  const decryptedWebhookSecret = decrypt(config.razorpay_webhook_secret)

  if (!decryptedWebhookSecret) {
    return NextResponse.json({ error: 'Razorpay webhook secret is missing or invalid' }, { status: 500 })
  }

  // Verify HMAC SHA256 signature
  const expectedSig = crypto
    .createHmac('sha256', decryptedWebhookSecret)
    .update(body)
    .digest('hex')

  if (expectedSig !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle payment_link.paid event
  if (event.event === 'payment_link.paid') {
    const paymentEntity = event.payload?.payment?.entity
    const razorpayPaymentId = paymentEntity?.id

    const pendingLink = await prisma.paymentLink.findFirst({
      where: {
        invoice_id: invoiceId,
        provider: 'razorpay',
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
        provider: 'razorpay',
        status: 'created',
      },
      data: {
        status: 'paid',
        paid_at: new Date(),
        provider_payment_id: razorpayPaymentId,
      },
    })

    // Update Invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: targetStatus,
        payment_method: 'Online (Razorpay)',
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
          payment_method: 'Online (Razorpay)',
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

  return NextResponse.json({ status: 'ok' })
}
