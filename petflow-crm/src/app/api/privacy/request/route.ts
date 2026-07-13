import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ─── Deadline calculator (per country/regulation) ─────────────────────────────
function getDeadline(country?: string | null): Date {
  const now = new Date()
  let daysToAdd = 30 // Default (GDPR / PDPL)

  if (country === 'IN') daysToAdd = 7   // DPDP Act 2023 — 7 days
  if (country === 'US') daysToAdd = 45  // CCPA — 45 days
  if (country === 'AE') daysToAdd = 30  // PDPL — 30 days

  const deadline = new Date(now)
  deadline.setDate(deadline.getDate() + daysToAdd)
  return deadline
}

/**
 * POST /api/privacy/request
 * 
 * Creates a Data Subject Access / Rights Request (DSAR).
 * Public endpoint — no auth required (requester identifies themselves by phone/email).
 * 
 * Body: { type, phone?, email?, notes? }
 * type: "ACCESS" | "ERASURE" | "PORTABILITY" | "RECTIFICATION" | "RESTRICTION"
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, phone, email, notes } = body

    if (!type || !['ACCESS', 'ERASURE', 'PORTABILITY', 'RECTIFICATION', 'RESTRICTION'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request type. Must be one of: ACCESS, ERASURE, PORTABILITY, RECTIFICATION, RESTRICTION' },
        { status: 400 }
      )
    }

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Please provide either a phone number or email to identify your account.' },
        { status: 400 }
      )
    }

    // Try to find the client + their tenant's country for deadline calculation
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          ...(phone ? [{ whatsapp_number: phone }] : []),
          ...(email ? [{ email }] : []),
        ]
      },
      include: {
        tenant: { include: { settings: true } }
      }
    })

    const country = client?.tenant?.settings?.[0]?.country || null
    const deadline = getDeadline(country)

    const dataRequest = await prisma.dataRequest.create({
      data: {
        tenantId: client?.tenantId || null,
        client_id: client?.id || null,
        phone: phone || null,
        email: email || null,
        type,
        status: 'Pending',
        notes: notes || null,
        country: country || null,
        deadline_at: deadline,
      }
    })

    // Log the DSAR creation
    if (client?.tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId: client.tenantId,
          action: 'dsar.created',
          entity_type: 'DataRequest',
          entity_id: dataRequest.id,
          metadata: { type, channel: 'api' }
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Your ${type} request has been received. We will respond within ${
        country === 'IN' ? '7 days (DPDP Act)' : country === 'US' ? '45 days (CCPA)' : '30 days (PDPL/GDPR)'
      }.`,
      request_id: dataRequest.id,
      deadline: deadline.toISOString()
    })

  } catch (error) {
    console.error('[Privacy Request Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/privacy/request
 * 
 * Returns public status of a specific DSAR by request ID (no auth, self-service).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('id')

  if (!requestId) {
    return NextResponse.json({ error: 'Request ID required' }, { status: 400 })
  }

  const dataRequest = await prisma.dataRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      type: true,
      status: true,
      deadline_at: true,
      fulfilled_at: true,
      created: true
    }
  })

  if (!dataRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  return NextResponse.json(dataRequest)
}
