import { prisma } from '@/lib/prisma'
import { getCurrentUser, getCurrentTenantId } from '@/lib/session-utils'
import { NextResponse } from 'next/server'

/**
 * POST /api/privacy/fulfill
 * 
 * Admin endpoint to fulfill a DSAR (Data Subject Access Request).
 * Handles ERASURE (right to be forgotten) and PORTABILITY (data export) actions.
 * Requires authenticated admin session.
 * 
 * Body: { requestId, action: "export" | "anonymize" | "update_status", status?, notes? }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'SpaAdmin' && user.role !== 'SuperAdmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const tenantId = await getCurrentTenantId()
    const body = await request.json()
    const { requestId, action, status, notes } = body

    const dataRequest = await prisma.dataRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { client: true }
    })

    if (!dataRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // ─── ACTION: Export client data (Portability / Access) ───────────────────
    if (action === 'export') {
      const client = dataRequest.client
      if (!client) {
        return NextResponse.json({ error: 'Client not found for this request' }, { status: 404 })
      }

      // Collect all data associated with this client
      const [
        pets,
        appointments,
        invoices,
        sales,
        chatSessions,
        consentLogs
      ] = await Promise.all([
        prisma.pet.findMany({ where: { owner_id: client.id } }),
        prisma.appointment.findMany({
          where: { pet: { owner_id: client.id } },
          include: { pet: true, groomer: { select: { name: true } } }
        }),
        prisma.invoice.findMany({
          where: { client_id: client.id },
          include: { sales: { include: { product: { select: { name: true } } } } }
        }),
        prisma.sale.findMany({ where: { client_id: client.id } }),
        prisma.chatSession.findMany({
          where: { client_id: client.id },
          include: { messages: { orderBy: { created: 'asc' } } }
        }),
        prisma.consentLog.findMany({ where: { client_id: client.id }, orderBy: { created: 'asc' } })
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        data_controller: `PetFlow Tenant: ${tenantId}`,
        subject: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.whatsapp_number,
          address: client.address,
          join_date: client.join_date,
          consent_given: client.consent_given,
          consent_date: client.consent_date,
          consent_channel: client.consent_channel,
          marketing_opt_in: client.marketing_opt_in
        },
        pets: pets.map(p => ({
          name: p.pet_name,
          species: p.species,
          breed: p.breed,
          weight: p.weight,
          medical_alerts: p.medical_alerts,
          temperament_notes: p.temperament_notes
        })),
        appointments: appointments.map(a => ({
          date: a.appointment_date,
          time: a.appointment_time,
          service: a.service_type,
          status: a.status,
          pet: a.pet.pet_name,
          groomer: a.groomer?.name || 'N/A',
          notes: a.notes
        })),
        invoices: invoices.map(inv => ({
          invoice_number: inv.invoice_number,
          total: inv.total_amount,
          status: inv.status,
          created: inv.created,
          items: inv.sales.map(s => ({ product: s.product.name, qty: s.quantity, price: s.unit_price }))
        })),
        chat_history: chatSessions.map(session => ({
          channel: session.channel,
          messages: session.messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.created
          }))
        })),
        consent_history: consentLogs.map(c => ({
          event: c.event,
          channel: c.channel,
          timestamp: c.created
        }))
      }

      // Update request status
      await prisma.dataRequest.update({
        where: { id: requestId },
        data: { status: 'Fulfilled', fulfilled_at: new Date(), notes: notes || 'Data exported' }
      })

      // Audit log
      await prisma.auditLog.create({
        data: {
          tenantId,
          user_id: user.id,
          user_email: user.email,
          action: 'dsar.exported',
          entity_type: 'Client',
          entity_id: client.id,
          metadata: { request_id: requestId }
        }
      })

      return NextResponse.json({ success: true, data: exportData })
    }

    // ─── ACTION: Anonymize / erase client PII (Right to be forgotten) ────────
    if (action === 'anonymize') {
      const client = dataRequest.client
      if (!client) {
        return NextResponse.json({ error: 'Client not found for this request' }, { status: 404 })
      }

      const anonymizedName = `[Deleted User ${client.id.slice(-6)}]`

      // Anonymize the Client record — null out all PII, keep financial records for legal retention
      await prisma.client.update({
        where: { id: client.id },
        data: {
          name: anonymizedName,
          whatsapp_number: null,
          email: null,
          address: null,
          consent_given: false,
          marketing_opt_in: false,
          is_anonymized: true,
          deletion_requested_at: dataRequest.created
        }
      })

      // Delete chat messages (personal conversation content)
      const sessions = await prisma.chatSession.findMany({ where: { client_id: client.id } })
      for (const session of sessions) {
        await prisma.chatMessage.deleteMany({ where: { session_id: session.id } })
      }
      await prisma.chatSession.deleteMany({ where: { client_id: client.id } })

      // Anonymize CampaignLog entries for this client
      await prisma.campaignLog.updateMany({
        where: { phone: client.whatsapp_number || '' },
        data: { clientName: '[Deleted]', phone: '[Deleted]' }
      })

      // Update request status
      await prisma.dataRequest.update({
        where: { id: requestId },
        data: { status: 'Fulfilled', fulfilled_at: new Date(), notes: notes || 'Client PII anonymized' }
      })

      // Audit log
      await prisma.auditLog.create({
        data: {
          tenantId,
          user_id: user.id,
          user_email: user.email,
          action: 'client.anonymized',
          entity_type: 'Client',
          entity_id: client.id,
          metadata: { request_id: requestId, request_type: dataRequest.type }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Client PII has been anonymized. Financial records are retained for legal compliance.'
      })
    }

    // ─── ACTION: Update request status only ──────────────────────────────────
    if (action === 'update_status') {
      if (!status || !['Pending', 'InProgress', 'Fulfilled', 'Rejected'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      const updated = await prisma.dataRequest.update({
        where: { id: requestId },
        data: {
          status,
          notes: notes || undefined,
          fulfilled_at: status === 'Fulfilled' ? new Date() : undefined
        }
      })

      await prisma.auditLog.create({
        data: {
          tenantId,
          user_id: user.id,
          user_email: user.email,
          action: 'dsar.status_updated',
          entity_type: 'DataRequest',
          entity_id: requestId,
          metadata: { new_status: status }
        }
      })

      return NextResponse.json({ success: true, request: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('[Privacy Fulfill Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/privacy/fulfill
 * 
 * Lists all pending/active DSAR requests for the current tenant.
 * Admin only.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'SpaAdmin' && user.role !== 'SuperAdmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const tenantId = await getCurrentTenantId()

    const requests = await prisma.dataRequest.findMany({
      where: { tenantId },
      include: { client: { select: { id: true, name: true, is_anonymized: true } } },
      orderBy: { created: 'desc' }
    })

    // Flag overdue requests
    const now = new Date()
    const enriched = requests.map(r => ({
      ...r,
      is_overdue: r.deadline_at ? r.deadline_at < now && r.status === 'Pending' : false
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('[Privacy List Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
