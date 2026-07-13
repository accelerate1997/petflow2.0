'use server'

import { prisma } from './prisma'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { sendWhatsApp, sendWhatsAppMedia } from './whatsapp'
import type { Pet, Appointment, Invoice } from '@/types'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import bcrypt from 'bcryptjs'
import { getCurrentTenantId, getCurrentUser } from './session-utils'
import { fireWebhook } from './webhook-dispatcher'
import { encrypt, decrypt } from './encryption'
import { getLocalDateString } from './dateUtils'


// ─── Products / Inventory ──────────────────────────────────────────────────────

export async function getProducts(opts?: string | { search?: string; category?: string; stockFilter?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' }) {
  const tenantId = await getCurrentTenantId()
  const options = typeof opts === 'string' ? { search: opts } : opts || {}
  const { search, category, stockFilter = 'all' } = options
  
  const products = await prisma.product.findMany({ 
    where: {
      tenantId,
      is_active: true,
      ...(category ? { category } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ]
      } : {})
    },
    orderBy: { name: 'asc' } 
  })

  if (stockFilter === 'all') return products

  return products.filter(p => {
    if (stockFilter === 'in_stock' && p.stock <= 0) return false
    if (stockFilter === 'out_of_stock' && p.stock > 0) return false
    if (stockFilter === 'low_stock' && (p.stock === 0 || p.stock > p.low_stock_threshold)) return false
    return true
  })
}

export async function createProduct(data: {
  name: string; sku?: string; category?: string; description?: string
  retail_price: number; cost_price?: number; stock?: number; low_stock_threshold?: number
  unit?: string; image_url?: string; is_active?: boolean; inventory_type?: string
}) {
  const tenantId = await getCurrentTenantId()
  const product = await prisma.product.create({ data: { ...data, tenantId } })
  revalidatePath('/inventory')
  return product
}

export async function updateProduct(id: string, data: Partial<{
  name: string; sku: string; category: string; description: string
  retail_price: number; cost_price: number; stock: number; low_stock_threshold: number
  unit: string; image_url: string; is_active: boolean; inventory_type: string
}>) {
  const current = await prisma.product.findUnique({ where: { id } })
  if (!current) throw new Error('Product not found')

  const updated = await prisma.product.update({ where: { id }, data })

  if (data.stock !== undefined) {
    const actualDelta = updated.stock - current.stock
    if (actualDelta !== 0) {
      await prisma.stockLog.create({
        data: {
          product_id: id,
          quantity: actualDelta,
          type: 'Manual Adjustment',
          notes: `Product details edited by staff: stock changed from ${current.stock} to ${updated.stock}`
        }
      })

      if (actualDelta < 0 && updated.is_active && updated.stock <= updated.low_stock_threshold) {
        const settings = await prisma.settings.findFirst()
        if (settings?.spa_whatsapp) {
          const message = `⚠️ *Low Stock Alert!*\n\n*${updated.name}* (SKU: ${updated.sku || 'N/A'}) has dropped to *${updated.stock} ${updated.unit || 'pcs'}* (Threshold: ${updated.low_stock_threshold}).\n\nPlease restock soon!`
          sendWhatsApp(settings.spa_whatsapp, message).catch(err => console.error('Low stock alert error:', err))
        }
      }
    }
  }

  revalidatePath('/inventory')
  return updated
}

export async function adjustStock(id: string, delta: number) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error('Product not found')
  const newStock = Math.max(0, product.stock + delta)
  const actualDelta = newStock - product.stock

  const updated = await prisma.product.update({ where: { id }, data: { stock: newStock } })

  if (actualDelta !== 0) {
    await prisma.stockLog.create({
      data: {
        product_id: id,
        quantity: actualDelta,
        type: 'Manual Adjustment',
        notes: `Manual stock adjustment: ${actualDelta > 0 ? '+' : ''}${actualDelta}`
      }
    })
  }

  if (actualDelta < 0 && updated.is_active && updated.stock <= updated.low_stock_threshold) {
    const settings = await prisma.settings.findFirst()
    if (settings?.spa_whatsapp) {
      const message = `⚠️ *Low Stock Alert!*\n\n*${updated.name}* (SKU: ${updated.sku || 'N/A'}) has dropped to *${updated.stock} ${updated.unit || 'pcs'}* (Threshold: ${updated.low_stock_threshold}).\n\nPlease restock soon!`
      sendWhatsApp(settings.spa_whatsapp, message).catch(err => console.error('Low stock alert error:', err))
    }
  }

  revalidatePath('/inventory')
  return updated
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } })
  revalidatePath('/inventory')
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaff(activeOnly = false) {
  const tenantId = await getCurrentTenantId()
  const user = await getCurrentUser()

  // Load all users under the tenant to check account existence
  const tenantUsers = await prisma.user.findMany({
    where: activeOnly 
      ? { tenantId, status: 'Active', role: { in: ['SpaAdmin', 'Staff'] } }
      : { tenantId, role: { in: ['SpaAdmin', 'Staff'] } },
    select: { id: true, name: true, tenantId: true, email: true, role: true, status: true, created: true, updated: true }
  })

  const userMap = new Map(
    tenantUsers.map(u => [u.email.toLowerCase(), u])
  )

  const staff = await prisma.staff.findMany({
    where: activeOnly ? { tenantId, status: 'Active' } : { tenantId },
    orderBy: { name: 'asc' }
  })

  // Format regular staff and attach account info if exists
  const formattedStaff = staff.map(s => {
    const userAcc = s.email ? userMap.get(s.email.toLowerCase()) : null
    return {
      ...s,
      hasAccount: !!userAcc,
      accessLevel: userAcc ? userAcc.role : null,
    }
  })

  const existingStaffEmails = new Set(
    staff.map(s => s.email?.toLowerCase()).filter(Boolean)
  )

  if (user.role === 'SuperAdmin') {
    const spaAdmins = await prisma.user.findMany({
      where: activeOnly 
        ? { role: 'SpaAdmin', status: 'Active' } 
        : { role: 'SpaAdmin' },
      orderBy: { name: 'asc' }
    })

    const formattedSpaAdmins = spaAdmins
      .filter(u => !existingStaffEmails.has(u.email.toLowerCase()))
      .map(u => ({
        id: u.id,
        tenantId: u.tenantId,
        name: u.name,
        phone: null,
        email: u.email,
        role: 'SpaAdmin',
        specialization: 'Spa Owner',
        status: u.status,
        working_hours: {},
        created: u.created,
        updated: u.updated,
        hasAccount: true,
        accessLevel: 'SpaAdmin',
      }))

    return [...formattedStaff, ...formattedSpaAdmins]
  }

  // Add registered users under the current tenant who don't have a Staff profile
  const formattedTenantUsers = tenantUsers
    .filter(u => !existingStaffEmails.has(u.email.toLowerCase()))
    .map(u => ({
      id: u.id,
      tenantId: u.tenantId,
      name: u.name,
      phone: null,
      email: u.email,
      role: u.role,
      specialization: u.role === 'SpaAdmin' ? 'Spa Owner' : 'Staff Member',
      status: u.status,
      working_hours: {},
      created: u.created,
      updated: u.updated,
      hasAccount: true,
      accessLevel: u.role,
    }))

  return [...formattedStaff, ...formattedTenantUsers]
}

export async function createStaff(data: any) {
  const tenantId = await getCurrentTenantId()
  const staff = await prisma.staff.create({ data: { ...data, tenantId } })
  revalidatePath('/staff')
  return staff
}

export async function updateStaff(id: string, data: any) {
  // Check if id is a User (SpaAdmin or Staff)
  const user = await prisma.user.findFirst({
    where: { id, role: { in: ['SpaAdmin', 'Staff'] } }
  })

  if (user) {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.accessLevel !== undefined) updateData.role = data.accessLevel
    if (data.status !== undefined) updateData.status = data.status

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    })

    // Also update any matching Staff record if details change
    if (user.email) {
      await prisma.staff.updateMany({
        where: { email: user.email },
        data: {
          name: data.name,
          email: data.email,
          status: data.status,
        }
      })
    }

    revalidatePath('/staff')
    return updatedUser
  }

  // Otherwise update Staff record
  const staff = await prisma.staff.update({ where: { id }, data })

  // Synchronize accessLevel changes to User table if a matching email exists
  if (staff.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: staff.email }
    })
    if (dbUser) {
      const userUpdate: any = {
        name: staff.name,
      }
      if (data.accessLevel !== undefined) {
        userUpdate.role = data.accessLevel
      }
      if (data.status !== undefined) {
        userUpdate.status = data.status
      }
      await prisma.user.update({
        where: { id: dbUser.id },
        data: userUpdate
      })
    }
  }

  revalidatePath('/staff')
  return staff
}

export async function deleteStaff(id: string) {
  // Check if id is a User (SpaAdmin or Staff)
  const user = await prisma.user.findFirst({
    where: { id, role: { in: ['SpaAdmin', 'Staff'] } }
  })

  if (user) {
    await prisma.user.delete({ where: { id } })
  } else {
    await prisma.staff.delete({ where: { id } })
  }

  revalidatePath('/staff')
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(search?: string) {
  const tenantId = await getCurrentTenantId()
  return await prisma.client.findMany({
    where: search ? {
      tenantId,
      name: { contains: search, mode: 'insensitive' }
    } : { tenantId },
    include: { pets: true },
    orderBy: { created: 'desc' }
  })
}

export async function createClient(data: any) {
  const tenantId = await getCurrentTenantId()
  const user = await getCurrentUser()

  // Separate consent fields from core client data
  const { consent_given, consent_date, consent_channel, marketing_opt_in, ...clientData } = data

  const client = await prisma.client.create({
    data: {
      ...clientData,
      tenantId,
      // ─── GDPR / DPDP: Save consent at creation time ────────────────────────
      consent_given: consent_given ?? false,
      consent_date: consent_given ? (consent_date ?? new Date()) : null,
      consent_channel: consent_given ? (consent_channel ?? 'manual') : null,
      marketing_opt_in: marketing_opt_in ?? false,
    }
  })

  // Log the consent event if consent was given (immutable audit trail)
  if (consent_given) {
    await prisma.consentLog.create({
      data: {
        tenantId,
        client_id: client.id,
        phone: client.whatsapp_number,
        event: 'granted',
        channel: consent_channel ?? 'manual',
        message_text: 'Verbal consent collected by staff at walk-in registration',
      }
    })

    if (marketing_opt_in) {
      await prisma.consentLog.create({
        data: {
          tenantId,
          client_id: client.id,
          phone: client.whatsapp_number,
          event: 'marketing_opt_in',
          channel: consent_channel ?? 'manual',
          message_text: 'Marketing consent collected by staff at walk-in registration',
        }
      })
    }
  }

  // Audit log — who created this client record
  await prisma.auditLog.create({
    data: {
      tenantId,
      user_id: user?.id,
      user_email: user?.email,
      action: 'client.created',
      entity_type: 'Client',
      entity_id: client.id,
      metadata: { channel: consent_channel ?? 'manual', consent_given: consent_given ?? false }
    }
  })

  // Fire outgoing webhook
  fireWebhook('client.created', tenantId, {
    id: client.id,
    name: client.name,
    email: client.email,
    whatsapp_number: client.whatsapp_number,
    join_date: client.join_date,
  })

  revalidatePath('/clients')
  return client
}
export async function updateClient(id: string, data: any) {
  const tenantId = await getCurrentTenantId()
  const user = await getCurrentUser()

  // Fetch current state before update to detect consent changes
  const existing = await prisma.client.findFirst({ where: { id, tenantId } })

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.whatsapp_number !== undefined) updateData.whatsapp_number = data.whatsapp_number
  if (data.email !== undefined) updateData.email = data.email
  if (data.address !== undefined) updateData.address = data.address
  if (data.total_spend !== undefined) updateData.total_spend = data.total_spend

  // Handle marketing consent change — record timestamp
  if (data.marketing_opt_in !== undefined && data.marketing_opt_in !== (existing as any)?.marketing_opt_in) {
    updateData.marketing_opt_in = data.marketing_opt_in
    updateData.marketing_opt_in_date = new Date()

    // Immutable consent audit entry
    try {
      await (prisma as any).consentLog.create({
        data: {
          tenantId,
          client_id: id,
          phone: existing?.whatsapp_number ?? null,
          event: data.marketing_opt_in ? 'marketing_opt_in' : 'marketing_opt_out',
          channel: 'staff_update',
          message_text: data.marketing_opt_in
            ? 'Marketing consent granted by staff via CRM update'
            : 'Marketing consent withdrawn by staff via CRM update',
          user_id: user?.id ?? null,
        }
      })
    } catch {
      // consentLog may not exist in older schema versions — fail silently
    }
  }

  const client = await prisma.client.update({
    where: { id, tenantId },
    data: updateData,
  })

  // Fire outgoing webhook
  fireWebhook('client.updated', tenantId, {
    id: client.id,
    name: client.name,
    email: client.email,
    whatsapp_number: client.whatsapp_number,
    join_date: client.join_date,
  })

  revalidatePath('/clients')
  return client
}

/**
 * GDPR / DPDP Compliant: Anonymize a client's PII on erasure request.
 * 
 * What it does:
 * - Nulls out name, phone, email, address (PII removed)
 * - Marks client as anonymized
 * - Deletes chat messages (personal conversations)
 * - KEEPS invoices, appointments, sales — required by law for 7 years
 * - Logs the action to AuditLog
 * 
 * Use this for all real "right to erasure" / deletion requests.
 */
export async function anonymizeClient(id: string) {
  const tenantId = await getCurrentTenantId()
  const user = await getCurrentUser()

  const client = await prisma.client.findFirst({ where: { id, tenantId } })
  if (!client) throw new Error('Client not found')

  const anonymizedName = `[Deleted User ${id.slice(-6)}]`

  // 1. Anonymize PII on the client record — keep financial & appointment history
  await prisma.client.update({
    where: { id },
    data: {
      name: anonymizedName,
      whatsapp_number: null,
      email: null,
      address: null,
      consent_given: false,
      marketing_opt_in: false,
      is_anonymized: true,
      deletion_requested_at: new Date(),
    }
  })

  // 2. Delete chat messages (personal conversations — not financial records)
  const chatSessions = await prisma.chatSession.findMany({ where: { client_id: id }, select: { id: true } })
  const sessionIds = chatSessions.map(s => s.id)
  if (sessionIds.length > 0) {
    await prisma.chatMessage.deleteMany({ where: { session_id: { in: sessionIds } } })
    await prisma.chatSession.deleteMany({ where: { client_id: id } })
  }

  // 3. Anonymize campaign logs mentioning this client's phone
  if (client.whatsapp_number) {
    await prisma.campaignLog.updateMany({
      where: { phone: client.whatsapp_number },
      data: { clientName: '[Deleted]', phone: '[Deleted]' }
    })
  }

  // 4. Log the erasure action (immutable audit trail)
  await prisma.auditLog.create({
    data: {
      tenantId,
      user_id: user?.id,
      user_email: user?.email,
      action: 'client.anonymized',
      entity_type: 'Client',
      entity_id: id,
      metadata: {
        reason: 'right_to_erasure',
        invoices_retained: true,
        appointments_retained: true,
      }
    }
  })

  revalidatePath('/clients')
  return { success: true }
}

/**
 * Hard delete — removes ALL client data including financial records.
 * ⚠️  NOT compliant for real clients with transaction history.
 *     Use ONLY for test accounts or clients with zero invoices/appointments.
 *     For real erasure requests, use anonymizeClient() above.
 */
export async function deleteClient(id: string) {
  // Delete in dependency order to respect all foreign key constraints

  // 1. Get all pets owned by this client
  const pets = await prisma.pet.findMany({ where: { owner_id: id }, select: { id: true } })
  const petIds = pets.map(p => p.id)

  // 2. Get all appointments for those pets
  const appointments = await prisma.appointment.findMany({
    where: { pet_id: { in: petIds } },
    select: { id: true }
  })
  const appointmentIds = appointments.map(a => a.id)

  // 3. Delete invoices linked to those appointments (and their product sales)
  await prisma.sale.deleteMany({ where: { invoice: { appointment_id: { in: appointmentIds } } } })
  await prisma.invoice.deleteMany({ where: { appointment_id: { in: appointmentIds } } })

  // 4. Delete direct client invoices & sales (retail sales not tied to an appointment)
  await prisma.sale.deleteMany({ where: { client_id: id } })
  await prisma.invoice.deleteMany({ where: { client_id: id, appointment_id: null } })

  // 5. Delete appointments
  await prisma.appointment.deleteMany({ where: { pet_id: { in: petIds } } })

  // 6. Delete vaccination records for all pets
  await prisma.vaccinationRecord.deleteMany({ where: { pet_id: { in: petIds } } })

  // 7. Delete pets
  await prisma.pet.deleteMany({ where: { owner_id: id } })

  // 8. Delete chat messages & sessions linked to client
  const chatSessions = await prisma.chatSession.findMany({ where: { client_id: id }, select: { id: true } })
  const sessionIds = chatSessions.map(s => s.id)
  await prisma.chatMessage.deleteMany({ where: { session_id: { in: sessionIds } } })
  await prisma.chatSession.deleteMany({ where: { client_id: id } })

  // 9. Finally delete the client
  await prisma.client.delete({ where: { id } })
  revalidatePath('/clients')
}

export async function getPets() {
  const tenantId = await getCurrentTenantId()
  return await prisma.pet.findMany({
    where: { tenantId },
    include: { owner: true, vaccinations: true },
    orderBy: { created: 'desc' }
  }) as unknown as Pet[]
}

export async function getPetsByOwner(ownerId: string) {
  const tenantId = await getCurrentTenantId()
  return await prisma.pet.findMany({
    where: { owner_id: ownerId, tenantId },
    orderBy: { pet_name: 'asc' }
  }) as unknown as Pet[]
}


export async function createPet(data: any) {
  const tenantId = await getCurrentTenantId()
  const pet = await prisma.pet.create({ data: { ...data, tenantId } })
  revalidatePath('/pets')
  return pet
}

export async function updatePet(id: string, data: any) {
  const pet = await prisma.pet.update({ where: { id }, data })
  revalidatePath('/pets')
  return pet
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getServices() {
  const tenantId = await getCurrentTenantId()
  return await prisma.service.findMany({
    where: { tenantId },
    orderBy: { service_name: 'asc' }
  })
}

export async function createService(data: {
  service_name: string
  pet_type?: string
  description?: string | null
  price: number
  price_small?: number | null
  price_medium?: number | null
  price_large?: number | null
  thumbnail?: string
  estimated_duration?: number
}) {
  const tenantId = await getCurrentTenantId()
  const service = await prisma.service.create({ data: { ...data, tenantId } })
  revalidatePath('/services')
  return service
}

export async function updateService(id: string, data: {
  service_name?: string
  pet_type?: string
  description?: string | null
  price?: number
  price_small?: number | null
  price_medium?: number | null
  price_large?: number | null
  thumbnail?: string
  estimated_duration?: number
}) {
  const service = await prisma.service.update({ where: { id }, data })
  revalidatePath('/services')
  return service
}

export async function deleteService(id: string) {
  await prisma.service.delete({ where: { id } })
  revalidatePath('/services')
}



// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(view: 'today' | 'tomorrow' | 'week' | 'all' = 'all', clientTodayStr?: string) {
  noStore()
  const tenantId = await getCurrentTenantId()
  let where: any = { tenantId }

  let todayStr = clientTodayStr;
  if (!todayStr) {
    todayStr = getLocalDateString(new Date())
  }

  // Parse todayStr to calculate tomorrowStr and nextWeekStr timezone-safely
  const [year, month, day] = todayStr.split('-').map(Number)
  const todayDate = new Date(year, month - 1, day)

  const tomorrowDate = new Date(todayDate)
  tomorrowDate.setDate(todayDate.getDate() + 1)
  const nextWeekDate = new Date(todayDate)
  nextWeekDate.setDate(todayDate.getDate() + 7)

  const tomorrowStr = getLocalDateString(tomorrowDate)
  const nextWeekStr = getLocalDateString(nextWeekDate)

  if (view === 'today') {
    where.appointment_date = todayStr
  } else if (view === 'tomorrow') {
    where.appointment_date = tomorrowStr
  } else if (view === 'week') {
    where.appointment_date = {
      gte: todayStr,
      lte: nextWeekStr
    }
  }

  return await prisma.appointment.findMany({
    where,
    include: { 
      pet: { 
        include: { owner: true } 
      },
      groomer: true,
      van: true,
    },
    orderBy: [
      { appointment_date: 'asc' },
      { appointment_time: 'asc' }
    ]
  }) as unknown as Appointment[]
}

export async function validateGroomerAvailability(
  appointmentId: string | null,
  date: string,
  time: string,
  serviceType: string,
  groomerId: string | null,
  tenantId: string = 'default-tenant-id'
): Promise<{ success: boolean; groomerId: string | null; error?: string }> {
  // 1. Calculate duration for the service type
  const serviceNames = serviceType.split('+').map(s => s.trim());
  const matchingServices = await prisma.service.findMany({
    where: { tenantId, service_name: { in: serviceNames } }
  });
  const duration = matchingServices.reduce((sum, s) => sum + s.estimated_duration, 0) || 60;

  const [hours, minutes] = time.split(':').map(Number);
  const requestedStart = hours * 60 + minutes;
  const requestedEnd = requestedStart + duration;

  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const [year, month, day] = date.split('-').map(Number);
  const dayName = daysOfWeek[new Date(year, month - 1, day).getDay()];

  // Helper to check if groomer is working during the requested time
  const isGroomerAvailableForShift = (groomer: any): { available: boolean; error?: string } => {
    const workingHours = (groomer.working_hours || {}) as any;
    if (Object.keys(workingHours).length === 0) {
      return { available: true };
    }
    const dayShift = workingHours[dayName];
    if (!dayShift) {
      return { available: false, error: `${groomer.name} is not scheduled to work on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.` };
    }
    if (!dayShift.is_working) {
      return { available: false, error: `${groomer.name} is not working on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.` };
    }
    if (dayShift.start && dayShift.end) {
      const [startH, startM] = dayShift.start.split(':').map(Number);
      const [endH, endM] = dayShift.end.split(':').map(Number);
      const shiftStart = startH * 60 + startM;
      const shiftEnd = endH * 60 + endM;
      if (requestedStart < shiftStart || requestedEnd > shiftEnd) {
        return {
          available: false,
          error: `Requested time ${time} - ${minutesToTimeStr(requestedEnd)} is outside ${groomer.name}'s working hours (${dayShift.start} - ${dayShift.end}).`
        };
      }
    }
    return { available: true };
  };

  // Helper to check if a specific groomer has overlapping appointments
  const hasConflict = async (gId: string): Promise<boolean> => {
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointment_date: date,
        groomer_id: gId,
        id: appointmentId ? { not: appointmentId } : undefined,
        status: { notIn: ['Cancelled', 'No-show', 'Done'] }
      }
    });

    for (const app of existingAppointments) {
      // Find duration of existing appointment
      const exServiceNames = app.service_type.split('+').map(s => s.trim());
      const exMatchingServices = await prisma.service.findMany({
        where: { tenantId, service_name: { in: exServiceNames } }
      });
      const exDuration = exMatchingServices.reduce((sum, s) => sum + s.estimated_duration, 0) || 60;

      const [exHours, exMinutes] = app.appointment_time.split(':').map(Number);
      const exStart = exHours * 60 + exMinutes;
      const exEnd = exStart + exDuration;

      // Overlap condition
      if (exStart < requestedEnd && exEnd > requestedStart) {
        return true;
      }
    }
    return false;
  };

  if (groomerId) {
    // Check specific groomer
    const groomer = await prisma.staff.findFirst({ where: { id: groomerId, tenantId } });
    if (!groomer) {
      return { success: false, groomerId: null, error: 'Groomer not found.' };
    }
    const shiftCheck = isGroomerAvailableForShift(groomer);
    if (!shiftCheck.available) {
      return { success: false, groomerId: null, error: shiftCheck.error };
    }
    const conflict = await hasConflict(groomerId);
    if (conflict) {
      return {
        success: false,
        groomerId: null,
        error: `Groomer ${groomer.name} is already booked between ${time} and ${minutesToTimeStr(requestedEnd)}.`
      };
    }
    return { success: true, groomerId };
  } else {
    // Auto-assign: Find all active groomers
    const activeGroomers = await prisma.staff.findMany({
      where: {
        tenantId,
        status: 'Active',
        role: { in: ['Groomer', 'Senior Groomer'] }
      }
    });

    if (activeGroomers.length === 0) {
      // No active groomers, proceed without assignment
      return { success: true, groomerId: null };
    }

    for (const groomer of activeGroomers) {
      const shiftCheck = isGroomerAvailableForShift(groomer);
      if (!shiftCheck.available) continue;

      const conflict = await hasConflict(groomer.id);
      if (!conflict) {
        // Found a free groomer!
        return { success: true, groomerId: groomer.id };
      }
    }

    return {
      success: false,
      groomerId: null,
      error: `All active groomers are fully booked or off-duty between ${time} and ${minutesToTimeStr(requestedEnd)}.`
    };
  }
}

function minutesToTimeStr(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export async function createAppointment(data: any) {
  const tenantId = await getCurrentTenantId()
  const check = await validateGroomerAvailability(
    null,
    data.appointment_date,
    data.appointment_time,
    data.service_type,
    data.groomer_id,
    tenantId
  );

  if (!check.success) {
    throw new Error(check.error);
  }

  if (check.groomerId) {
    data.groomer_id = check.groomerId;
  }

  const appt = await prisma.appointment.create({ 
    data: { ...data, tenantId },
    include: { pet: { include: { owner: true } } }
  })

  // WhatsApp Confirmation
  if (appt.pet?.owner?.whatsapp_number) {
    const msg = `*Booking Confirmed!* 🐾\n\nHi ${appt.pet.owner.name}, your appointment for *${appt.pet.pet_name}* is confirmed for ${appt.appointment_date} at ${appt.appointment_time}. We look forward to seeing you!`
    await sendWhatsApp(appt.pet.owner.whatsapp_number, msg)
  }

  // Fire outgoing webhook
  fireWebhook('appointment.created', tenantId, {
    id: appt.id,
    pet_name: appt.pet?.pet_name,
    owner_name: appt.pet?.owner?.name,
    owner_email: appt.pet?.owner?.email,
    service: appt.service_type,
    date: appt.appointment_date,
    time: appt.appointment_time,
    status: appt.status,
    price: appt.price,
    notes: appt.notes,
  })

  revalidatePath('/appointments')
  revalidatePath('/crm')
  revalidatePath('/dashboard')
  return appt
}

export async function updateAppointment(id: string, data: { 
  appointment_date?: string; 
  appointment_time?: string; 
  notes?: string; 
  groomer_id?: string | null; 
  price?: number;
  grooming_notes?: string;
  before_photos?: string[];
  after_photos?: string[];
  status?: string;
  payment_status?: string;
  van_id?: string | null;
}) {
  const tenantId = await getCurrentTenantId()
  const existingAppt = await prisma.appointment.findFirst({ where: { id, tenantId } });
  if (!existingAppt) {
    throw new Error('Appointment not found');
  }

  const date = data.appointment_date !== undefined ? data.appointment_date : existingAppt.appointment_date;
  const time = data.appointment_time !== undefined ? data.appointment_time : existingAppt.appointment_time;
  const groomerId = data.groomer_id !== undefined ? data.groomer_id : existingAppt.groomer_id;
  const status = data.status !== undefined ? data.status : existingAppt.status;

  if (
    status !== 'Cancelled' &&
    status !== 'No-show' &&
    status !== 'Done' &&
    (data.appointment_date !== undefined ||
      data.appointment_time !== undefined ||
      data.groomer_id !== undefined ||
      data.status !== undefined)
  ) {
    const check = await validateGroomerAvailability(
      id,
      date,
      time,
      existingAppt.service_type,
      groomerId,
      tenantId
    );

    if (!check.success) {
      throw new Error(check.error);
    }

    if (check.groomerId) {
      data.groomer_id = check.groomerId;
    }
  }

  const appt = await prisma.appointment.update({ where: { id }, data })
  revalidatePath('/appointments')
  revalidatePath('/crm')
  return appt
}

export async function saveGroomingRecord(id: string, data: { grooming_notes: string; before_photos?: string[]; after_photos?: string[] }) {
  const appt = await prisma.appointment.update({
    where: { id },
    data: {
      grooming_notes: data.grooming_notes,
      before_photos: data.before_photos || [],
      after_photos: data.after_photos || [],
    }
  })
  revalidatePath('/appointments')
  revalidatePath('/crm')
  return appt
}

export async function getPetGroomingHistory(petId: string) {
  return await prisma.appointment.findMany({
    where: { pet_id: petId, status: 'Done' },
    orderBy: { appointment_date: 'desc' },
    include: { groomer: true }
  })
}

export async function updateAppointmentStatus(id: string, status: string) {
  const appt = await prisma.appointment.update({
    where: { id },
    data: { status },
    include: { pet: { include: { owner: true } } }
  })

  // WhatsApp "Ready for Pickup"
  if (status === 'Done' && appt.pet?.owner?.whatsapp_number) {
    const msg = `*Service Complete!* 🛁✨\n\nHi ${appt.pet.owner.name}, *${appt.pet.pet_name}* is all groomed and ready for pickup! You can come and collect your pet now.`
    if (appt.after_photos && appt.after_photos.length > 0) {
      await sendWhatsAppMedia(appt.pet.owner.whatsapp_number, appt.after_photos[0], msg)
    } else {
      await sendWhatsApp(appt.pet.owner.whatsapp_number, msg)
    }
  }

  // Fire outgoing webhook
  if (appt.tenantId) {
    const event = status === 'Cancelled' ? 'appointment.cancelled' : 'appointment.updated'
    fireWebhook(event, appt.tenantId, {
      id: appt.id,
      pet_name: appt.pet?.pet_name,
      owner_name: appt.pet?.owner?.name,
      service: appt.service_type,
      date: appt.appointment_date,
      time: appt.appointment_time,
      status,
      price: appt.price,
    })
  }

  revalidatePath('/appointments')
  revalidatePath('/crm')
}

export async function updatePaymentStatus(id: string, payment_status: string) {
  const updated = await prisma.appointment.update({
    where: { id },
    data: { payment_status }
  })
  revalidatePath('/appointments')
  revalidatePath('/crm')
  return updated
}

export async function deleteAppointment(id: string) {
  const tenantId = await getCurrentTenantId()
  
  // Find appointment and its associated invoice
  const appt = await prisma.appointment.findFirst({
    where: { id, tenantId },
    include: { invoice: true }
  })
  
  if (!appt) {
    throw new Error('Appointment not found')
  }

  // If there's an associated invoice, clean up its dependent records first
  if (appt.invoice) {
    const invoiceId = appt.invoice.id
    await prisma.$transaction([
      prisma.paymentLink.deleteMany({
        where: { invoice_id: invoiceId }
      }),
      prisma.sale.deleteMany({
        where: { invoice_id: invoiceId }
      }),
      prisma.invoice.delete({
        where: { id: invoiceId }
      }),
      prisma.appointment.delete({
        where: { id }
      })
    ])
  } else {
    await prisma.appointment.delete({
      where: { id }
    })
  }

  revalidatePath('/appointments')
  revalidatePath('/crm')
  revalidatePath('/dashboard')
}

// ─── Settings & Config ────────────────────────────────────────────────────────

export async function getSettings() {
  noStore()
  const tenantId = await getCurrentTenantId()
  return await prisma.settings.findFirst({ where: { tenantId } })
}

export async function updateSettings(id: string | null, data: any) {
  const tenantId = await getCurrentTenantId()
  if (id) {
    await prisma.settings.update({ where: { id }, data: { ...data, tenantId } })
  } else {
    await prisma.settings.create({ data: { ...data, tenantId } })
  }
  revalidatePath('/settings')
}

export async function getWhatsAppConfig() {
  const tenantId = await getCurrentTenantId()
  const config = await prisma.whatsAppConfig.findFirst({ where: { tenantId } })

  const uniqueSuffix = tenantId === 'default-tenant-id' ? '' : tenantId.slice(-6).toLowerCase()
  const baseInstanceName = process.env.INSTANCE_NAME || 'petflow'

  const defaults = {
    id: '',
    evolution_api_url: process.env.EVOLUTION_API_URL || process.env.Evolution_api_url || '',
    evolution_api_key: process.env.EVOLUTION_API_KEY || process.env.Evolution_api_key || '',
    instance_name: uniqueSuffix ? `${baseInstanceName}_${uniqueSuffix}` : baseInstanceName,
    openai_api_key: process.env.OPENAI_API_KEY || '',
    openai_model: 'gpt-4o-mini',
    agent_public_url: process.env.AGENT_PUBLIC_URL || '',
    booking_link: '',
    spa_name: '',
    system_prompt: '',
    twilio_account_sid: process.env.TWILIO_ACCOUNT_SID || '',
    twilio_auth_token: process.env.TWILIO_AUTH_TOKEN || '',
    twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
    instagram_page_access_token: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '',
    instagram_business_account_id: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    instagram_verify_token: process.env.INSTAGRAM_VERIFY_TOKEN || '',
  }

  if (config) {
    return {
      ...defaults,
      ...config,
      evolution_api_url: config.evolution_api_url || defaults.evolution_api_url,
      evolution_api_key: decrypt(config.evolution_api_key) || defaults.evolution_api_key,
      instance_name: config.instance_name || defaults.instance_name,
      openai_api_key: decrypt(config.openai_api_key) || defaults.openai_api_key,
      agent_public_url: config.agent_public_url || defaults.agent_public_url,
      twilio_account_sid: config.twilio_account_sid || defaults.twilio_account_sid,
      twilio_auth_token: config.twilio_auth_token ? decrypt(config.twilio_auth_token) : defaults.twilio_auth_token,
      twilio_phone_number: config.twilio_phone_number || defaults.twilio_phone_number,
      instagram_page_access_token: config.instagram_page_access_token ? decrypt(config.instagram_page_access_token) : defaults.instagram_page_access_token,
      instagram_business_account_id: config.instagram_business_account_id || defaults.instagram_business_account_id,
      instagram_verify_token: config.instagram_verify_token || defaults.instagram_verify_token,
    }
  }

  return defaults
}

export async function updateWhatsAppConfig(id: string | null, data: any) {
  const tenantId = await getCurrentTenantId()
  
  const encryptedData = {
    ...data,
    evolution_api_key: data.evolution_api_key ? encrypt(data.evolution_api_key) : null,
    openai_api_key: data.openai_api_key ? encrypt(data.openai_api_key) : null,
    twilio_auth_token: data.twilio_auth_token ? encrypt(data.twilio_auth_token) : null,
    instagram_page_access_token: data.instagram_page_access_token ? encrypt(data.instagram_page_access_token) : null,
  }

  if (id) {
    await prisma.whatsAppConfig.update({ where: { id }, data: { ...encryptedData, tenantId } })
  } else {
    await prisma.whatsAppConfig.create({ data: { ...encryptedData, tenantId } })
  }
  revalidatePath('/settings')
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const tenantId = await getCurrentTenantId()
  const [petCount, clients, appointments] = await Promise.all([
    prisma.pet.count({ where: { tenantId } }),
    prisma.client.findMany({
      where: { tenantId },
      select: { id: true, name: true, total_spend: true, join_date: true, created: true },
      orderBy: { created: 'desc' }
    }),
    prisma.appointment.findMany({
      where: { 
        tenantId,
        created: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } 
      },
      select: { price: true, status: true, created: true }
    })
  ])

  return { petCount, clients, appointments }
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export async function createInvoice(data: {
  appointment_id?: string
  boarding_reservation_id?: string
  client_id?: string
  subtotal: number
  discount: number
  discount_type: 'flat' | 'percent'
  tax_rate: number
  tax_amount: number
  tip_amount?: number
  total_amount: number
  payment_method: string
  cash_amount?: number
  upi_amount?: number
  invoice_notes?: string
  status?: string
  productSales?: { productId: string; quantity: number; price: number }[]
}) {
  // Find the last created invoice to determine the next sequential invoice number
  const tenantId = await getCurrentTenantId()
  const settings = await prisma.settings.findFirst({ where: { tenantId } })
  const currencySymbol = settings?.currency_symbol || '₹'
  const currencyCode = settings?.currency_code || 'INR'

  const lastInvoice = await prisma.invoice.findFirst({
    where: { tenantId },
    orderBy: { created: 'desc' },
    select: { invoice_number: true }
  })
  
  let nextNum = 1
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/\d+/)
    if (match) {
      nextNum = parseInt(match[0], 10) + 1
    }
  }
  
  let invoice_number = `PF-${String(nextNum).padStart(4, '0')}`
  let collision = await prisma.invoice.findUnique({ where: { invoice_number } })
  while (collision) {
    nextNum++
    invoice_number = `PF-${String(nextNum).padStart(4, '0')}`
    collision = await prisma.invoice.findUnique({ where: { invoice_number } })
  }

  let clientId = data.client_id
  let ownerName = 'Customer'
  let petName = ''
  let serviceType = ''
  let whatsappNumber = ''

  // If linked to appointment, fetch details
  if (data.appointment_id) {
    const appt = await prisma.appointment.findUnique({
      where: { id: data.appointment_id },
      include: { pet: { include: { owner: true } } }
    })
    if (!appt) throw new Error('Appointment not found')
    
    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { appointment_id: data.appointment_id }
    })
    if (existing) {
      throw new Error(`Invoice already exists (#${existing.invoice_number}) for this appointment.`)
    }

    clientId = appt.pet.owner_id
    ownerName = appt.pet.owner.name
    petName = appt.pet.pet_name
    serviceType = appt.service_type
    whatsappNumber = appt.pet.owner.whatsapp_number || ''
  } else if (data.boarding_reservation_id) {
    const boarding = await prisma.boardingReservation.findUnique({
      where: { id: data.boarding_reservation_id },
      include: { pet: { include: { owner: true } }, room: true }
    })
    if (!boarding) throw new Error('Boarding reservation not found')
    
    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { boarding_reservation_id: data.boarding_reservation_id }
    })
    if (existing) {
      throw new Error(`Invoice already exists (#${existing.invoice_number}) for this boarding reservation.`)
    }

    clientId = boarding.pet.owner_id
    ownerName = boarding.pet.owner.name
    petName = boarding.pet.pet_name
    serviceType = `Boarding Stay (${boarding.room.name})`
    whatsappNumber = boarding.pet.owner.whatsapp_number || ''
  } else if (data.client_id) {
    const client = await prisma.client.findUnique({ where: { id: data.client_id } })
    if (client) {
      ownerName = client.name
      whatsappNumber = client.whatsapp_number || ''
    }
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoice_number,
      tenantId,
      appointment_id: data.appointment_id || null,
      boarding_reservation_id: data.boarding_reservation_id || null,
      client_id: clientId || null,
      subtotal: data.subtotal,
      discount: data.discount,
      discount_type: data.discount_type,
      tax_rate: data.tax_rate,
      tax_amount: data.tax_amount,
      tip_amount: data.tip_amount ?? 0,
      total_amount: data.total_amount,
      payment_method: data.payment_method,
      cash_amount: data.cash_amount ?? null,
      upi_amount: data.upi_amount ?? null,
      invoice_notes: data.invoice_notes ?? null,
      status: data.status || 'Paid',
      sales: {
        create: data.productSales?.map(s => ({
          tenantId,
          client_id: clientId || undefined,
          product_id: s.productId,
          quantity: s.quantity,
          unit_price: s.price,
          total_price: s.price * s.quantity
        }))
      }
    }
  })

  // Decrement stock
  if (data.productSales) {
    for (const s of data.productSales) {
      const p = await prisma.product.update({
        where: { id: s.productId },
        data: { stock: { decrement: s.quantity } }
      })

      // Log StockLog
      await prisma.stockLog.create({
        data: {
          product_id: s.productId,
          quantity: -s.quantity,
          type: 'Sale',
          notes: `Sold in invoice ${invoice_number}`
        }
      })

      // Low Stock Alert
      if (p.is_active && p.stock <= p.low_stock_threshold) {
        const settings = await prisma.settings.findFirst()
        if (settings?.spa_whatsapp) {
          const message = `⚠️ *Low Stock Alert!*\n\n*${p.name}* (SKU: ${p.sku || 'N/A'}) has dropped to *${p.stock} ${p.unit || 'pcs'}* (Threshold: ${p.low_stock_threshold}).\n\nPlease restock soon!`
          sendWhatsApp(settings.spa_whatsapp, message).catch(err => console.error('Low stock alert error:', err))
        }
      }
    }
  }

  // Update appointment status if applicable
  if (data.appointment_id) {
    const paymentStatus = data.status === 'Unpaid'
      ? 'Pending'
      : (data.payment_method === 'Cash' ? 'Cash' : data.payment_method === 'UPI' ? 'UPI' : 'Paid')
    await prisma.appointment.update({
      where: { id: data.appointment_id },
      data: { payment_status: paymentStatus, status: 'CheckOut' }
    })
  }

  // Update boarding reservation status if applicable
  if (data.boarding_reservation_id) {
    const paymentStatus = data.status === 'Unpaid'
      ? 'Pending'
      : (data.payment_method === 'Cash' ? 'Cash' : data.payment_method === 'UPI' ? 'UPI' : 'Paid')
    
    // We update status to CheckedOut when payment is finalized
    await prisma.boardingReservation.update({
      where: { id: data.boarding_reservation_id },
      data: { payment_status: paymentStatus, payment_method: data.payment_method, status: 'CheckedOut' }
    }).catch(err => console.error('Error updating boarding reservation on checkout:', err))

    // Link any retail sales made during the stay to this invoice
    await prisma.sale.updateMany({
      where: {
        boarding_reservation_id: data.boarding_reservation_id,
        invoice_id: null
      },
      data: {
        invoice_id: invoice.id
      }
    }).catch(err => console.error('Error linking sales to invoice:', err))

    // Update status of linked appointments to Done and Paid
    await prisma.appointment.updateMany({
      where: {
        boarding_reservation_id: data.boarding_reservation_id,
        status: { not: 'Cancelled' }
      },
      data: {
        payment_status: paymentStatus,
        status: 'Done'
      }
    }).catch(err => console.error('Error updating appointments on checkout:', err))

    // Send WhatsApp check-out confirmation
    const reservation = await prisma.boardingReservation.findUnique({
      where: { id: data.boarding_reservation_id },
      include: { pet: { include: { owner: true } } }
    })
    if (reservation?.pet?.owner?.whatsapp_number) {
      const msg = `🐾 *Checkout Complete!*\n\nHi ${reservation.pet.owner.name}, *${reservation.pet.pet_name}* has checked out and is ready to go home! Thank you for choosing PetFlow Spa.\n\n💰 Total Paid: ${currencySymbol}${data.total_amount} via ${data.payment_method}\n\nWe hope to see you again soon! ✨`
      sendWhatsApp(reservation.pet.owner.whatsapp_number, msg).catch(err => console.error('WhatsApp checkout error:', err))
    }
  }

  // Update client spend
  if (clientId) {
    await prisma.client.update({
      where: { id: clientId },
      data: { total_spend: { increment: data.total_amount } }
    }).catch(() => {})
  }

  // ─── WhatsApp Notification ───
  if (whatsappNumber) {
    const totalStr = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(data.total_amount);
    
    let productDetails = '';
    if (data.productSales && data.productSales.length > 0) {
      const productIds = data.productSales.map(s => s.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });
      
      productDetails = '\n*Retail Items:*';
      data.productSales.forEach(sale => {
        const p = products.find(prod => prod.id === sale.productId);
        if (p) productDetails += `\n- ${p.name} (x${sale.quantity})`;
      });
    }

    const summaryLine = serviceType 
      ? `- Service: ${serviceType}${productDetails}`
      : `- Items: ${productDetails.replace('\n*Retail Items:*', '')}`;

    const msg = `*Invoice Generated!* 🧾\n\nHi ${ownerName}, thank you for your purchase at *PetFlow Spa*! 🐾\n\n*Summary:*\n${summaryLine}\n- Total Amount: ${totalStr}\n- Status: Paid via ${data.payment_method}\n\nHope to see you again soon. Have a pawsome day! ✨`
    
    sendWhatsApp(whatsappNumber, msg).catch(err => console.error('WhatsApp error:', err));
  }

  revalidatePath('/appointments')
  revalidatePath('/boarding')
  revalidatePath('/crm')
  revalidatePath('/clients')
  revalidatePath('/analytics')
  revalidatePath('/billing')

  // Fire outgoing webhook
  fireWebhook('invoice.created', tenantId, {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    client_name: ownerName,
    pet_name: petName,
    service: serviceType,
    subtotal: data.subtotal,
    discount: data.discount,
    tax_amount: data.tax_amount,
    total_amount: data.total_amount,
    payment_method: data.payment_method,
    status: data.status || 'Paid',
  })

  return invoice
}


export async function updateInvoice(id: string, data: {
  subtotal: number
  discount: number
  discount_type: string
  tax_rate: number
  tax_amount: number
  tip_amount?: number
  total_amount: number
  payment_method: string
  cash_amount?: number
  upi_amount?: number
  invoice_notes?: string
  status?: string
  productSales?: { productId: string; quantity: number; price: number }[]
}) {
  const tenantId = await getCurrentTenantId()
  const settings = await prisma.settings.findFirst({ where: { tenantId } })
  const currencySymbol = settings?.currency_symbol || '₹'
  const currencyCode = settings?.currency_code || 'INR'

  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: { appointment: true, boarding_reservation: true }
  })
  if (!invoice) throw new Error('Invoice not found')

  // Handle product sales updates
  if (data.productSales && data.productSales.length > 0) {
    // Delete old sales if any
    await prisma.sale.deleteMany({ where: { invoice_id: id } })

    // Create new sales and update inventory
    await prisma.invoice.update({
      where: { id },
      data: {
        sales: {
          create: data.productSales.map(s => ({
            tenantId,
            client_id: invoice.client_id || undefined,
            product_id: s.productId,
            quantity: s.quantity,
            unit_price: s.price,
            total_price: s.price * s.quantity
          }))
        }
      }
    })

    // Decrement stock & log
    for (const s of data.productSales) {
      const p = await prisma.product.update({
        where: { id: s.productId },
        data: { stock: { decrement: s.quantity } }
      })

      await prisma.stockLog.create({
        data: {
          product_id: s.productId,
          quantity: -s.quantity,
          type: 'Sale',
          notes: `Sold in invoice update ${invoice.invoice_number}`
        }
      })

      if (p.is_active && p.stock <= p.low_stock_threshold) {
        if (settings?.spa_whatsapp) {
          const message = `⚠️ *Low Stock Alert!*\n\n*${p.name}* (SKU: ${p.sku || 'N/A'}) has dropped to *${p.stock} ${p.unit || 'pcs'}* (Threshold: ${p.low_stock_threshold}).\n\nPlease restock soon!`
          sendWhatsApp(settings.spa_whatsapp, message).catch(err => console.error('Low stock alert error:', err))
        }
      }
    }
  }

  // Update the invoice main fields
  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      subtotal: data.subtotal,
      discount: data.discount,
      discount_type: data.discount_type,
      tax_rate: data.tax_rate,
      tax_amount: data.tax_amount,
      tip_amount: data.tip_amount ?? 0,
      total_amount: data.total_amount,
      payment_method: data.payment_method,
      cash_amount: data.cash_amount ?? null,
      upi_amount: data.upi_amount ?? null,
      invoice_notes: data.invoice_notes ?? null,
      status: data.status || 'Paid'
    },
    include: { client: true, appointment: { include: { pet: { include: { owner: true } } } }, boarding_reservation: true }
  })

  // Update appointment status if applicable
  if (invoice.appointment_id) {
    const paymentStatus = data.status === 'Unpaid'
      ? 'Pending'
      : (data.payment_method === 'Cash' ? 'Cash' : data.payment_method === 'UPI' ? 'UPI' : 'Paid')
    
    await prisma.appointment.update({
      where: { id: invoice.appointment_id },
      data: { payment_status: paymentStatus, status: 'CheckOut' }
    })
  }

  // Update boarding reservation status if applicable
  if (invoice.boarding_reservation_id) {
    const paymentStatus = data.status === 'Unpaid'
      ? 'Pending'
      : (data.payment_method === 'Cash' ? 'Cash' : data.payment_method === 'UPI' ? 'UPI' : 'Paid')

    await prisma.boardingReservation.update({
      where: { id: invoice.boarding_reservation_id },
      data: { payment_status: paymentStatus, payment_method: data.payment_method, status: 'CheckedOut' }
    })
  }

  // Update client spend
  if (invoice.client_id) {
    await prisma.client.update({
      where: { id: invoice.client_id },
      data: { total_spend: { increment: data.total_amount - invoice.total_amount } }
    }).catch(() => {})
  }

  // Send WhatsApp notification
  let clientPhone = ''
  let clientName = 'Customer'
  if (updatedInvoice.client) {
    clientPhone = updatedInvoice.client.whatsapp_number || ''
    clientName = updatedInvoice.client.name
  } else if (updatedInvoice.appointment?.pet?.owner) {
    clientPhone = updatedInvoice.appointment.pet.owner.whatsapp_number || ''
    clientName = updatedInvoice.appointment.pet.owner.name
  }

  if (clientPhone) {
    const totalStr = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(data.total_amount)
    const msg = `*Invoice Finalized!* 🧾\n\nHi ${clientName}, your invoice *#${updatedInvoice.invoice_number}* at *${settings?.spa_name || 'PetFlow Spa'}* has been finalized.\n\n- Total Amount: ${totalStr}\n- Status: Paid via ${data.payment_method}\n\nThank you for choosing us! Have a pawsome day! ✨`
    sendWhatsApp(clientPhone, msg).catch(err => console.error('WhatsApp error:', err))
  }

  revalidatePath('/appointments')
  revalidatePath('/boarding')
  revalidatePath('/crm')
  revalidatePath('/clients')
  revalidatePath('/analytics')
  revalidatePath('/billing')

  // Fire webhook
  fireWebhook('invoice.updated', tenantId, {
    id: updatedInvoice.id,
    invoice_number: updatedInvoice.invoice_number,
    client_name: clientName,
    total_amount: updatedInvoice.total_amount,
    payment_method: updatedInvoice.payment_method,
    status: updatedInvoice.status
  })

  return updatedInvoice
}


export async function getInvoice(id: string) {
  const tenantId = await getCurrentTenantId()
  return await prisma.invoice.findFirst({
    where: {
      tenantId,
      OR: [
        { id: id },
        { appointment_id: id },
        { boarding_reservation_id: id }
      ]
    },
    include: {
      appointment: {
        include: {
          pet: { include: { owner: true } },
          groomer: true,
        }
      },
      boarding_reservation: {
        include: {
          pet: { include: { owner: true } },
          room: true,
          appointments: { include: { groomer: true } },
          sales: { include: { product: true } }
        }
      },
      client: true,
      sales: {
        include: { product: true }
      }
    }
  }) as unknown as Invoice
}

// ─── Analytics / Financial Stats ─────────────────────────────────────────────

export async function getFinancialStats(timeRange: '7days' | '30days' | 'thismonth' | '6months' | 'all' = '6months') {
  noStore()
  const tenantId = await getCurrentTenantId()
  
  const now = new Date()
  let startDate: Date | undefined = undefined
  
  if (timeRange === '7days') {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
  } else if (timeRange === '30days') {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 29)
    startDate.setHours(0, 0, 0, 0)
  } else if (timeRange === 'thismonth') {
    startDate = new Date()
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  } else if (timeRange === '6months') {
    startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 5)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  }

  const whereClause: any = { tenantId }
  if (startDate) {
    whereClause.created = { gte: startDate }
  }

  const [invoices, allInvoices, appointmentsWithDetails, allProducts, roomsCount, occupiedRoomsCount] = await Promise.all([
    prisma.invoice.findMany({
      where: whereClause,
      include: {
        sales: true,
        appointment: true,
        boarding_reservation: {
          include: {
            appointments: true
          }
        }
      },
      orderBy: { created: 'asc' }
    }),
    prisma.invoice.findMany({
      where: { tenantId },
      select: { total_amount: true, created: true }
    }),
    prisma.appointment.findMany({
      where: startDate ? {
        tenantId,
        created: { gte: startDate }
      } : { tenantId },
      select: {
        status: true,
        price: true,
        service_type: true,
        groomer: { select: { name: true } }
      }
    }),
    prisma.product.findMany({
      where: { tenantId, is_active: true }
    }),
    prisma.boardingRoom.count({
      where: { tenantId, status: { not: 'Maintenance' } }
    }),
    prisma.boardingReservation.count({
      where: { tenantId, status: 'CheckedIn' }
    })
  ])

  // Process invoices and divide revenue proportionally
  let totalRevenue = 0
  let totalServiceRevenue = 0
  let totalBoardingRevenue = 0
  let totalProductRevenue = 0

  const paymentBreakdown = { Cash: 0, UPI: 0, Split: 0 }

  // We will build trend data points
  // Group by day for short ranges, group by month for long ranges
  const isShortRange = ['7days', '30days', 'thismonth'].includes(timeRange)
  
  const trendObj: Record<string, { label: string; total: number; service: number; boarding: number; product: number }> = {}
  
  // Initialize trend bins
  if (timeRange === '7days') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      trendObj[label] = { label, total: 0, service: 0, boarding: 0, product: 0 }
    }
  } else if (timeRange === '30days') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      trendObj[label] = { label, total: 0, service: 0, boarding: 0, product: 0 }
    }
  } else if (timeRange === 'thismonth') {
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), i)
      if (d <= today) {
        const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        trendObj[label] = { label, total: 0, service: 0, boarding: 0, product: 0 }
      }
    }
  } else {
    // 6months or all (default to monthly bins for 6 months)
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleString('default', { month: 'short' })
      trendObj[label] = { label, total: 0, service: 0, boarding: 0, product: 0 }
    }
  }

  invoices.forEach(inv => {
    // Calculate proportional shares
    const productsRaw = inv.sales.reduce((sum, s) => sum + s.total_price, 0)
    
    let spaRaw = 0
    if (inv.appointment) {
      spaRaw = inv.appointment.price || 0
    } else if (inv.boarding_reservation) {
      spaRaw = inv.boarding_reservation.appointments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0
    }

    let lodgingRaw = 0
    if (inv.boarding_reservation) {
      lodgingRaw = inv.boarding_reservation.total_amount || 0
    }

    const totalRaw = productsRaw + spaRaw + lodgingRaw
    
    let productsShare = 0
    let spaShare = 0
    let lodgingShare = 0

    if (totalRaw > 0) {
      productsShare = (productsRaw / totalRaw) * inv.total_amount
      spaShare = (spaRaw / totalRaw) * inv.total_amount
      lodgingShare = (lodgingRaw / totalRaw) * inv.total_amount
    } else {
      // Fallback
      if (inv.boarding_reservation_id) lodgingShare = inv.total_amount
      else if (inv.appointment_id) spaShare = inv.total_amount
      else productsShare = inv.total_amount
    }

    totalRevenue += inv.total_amount
    totalServiceRevenue += spaShare
    totalBoardingRevenue += lodgingShare
    totalProductRevenue += productsShare

    // Payment methods
    if (inv.payment_method === 'Cash') paymentBreakdown.Cash += 1
    else if (inv.payment_method === 'UPI') paymentBreakdown.UPI += 1
    else if (inv.payment_method === 'Split') paymentBreakdown.Split += 1

    // Trend grouping
    const dateObj = new Date(inv.created)
    let label = ''
    if (isShortRange) {
      label = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    } else {
      label = dateObj.toLocaleString('default', { month: 'short' })
    }

    if (trendObj[label]) {
      trendObj[label].total += inv.total_amount
      trendObj[label].service += spaShare
      trendObj[label].boarding += lodgingShare
      trendObj[label].product += productsShare
    } else if (timeRange === 'all') {
      trendObj[label] = { label, total: inv.total_amount, service: spaShare, boarding: lodgingShare, product: productsShare }
    }
  })

  // Format trend data for charting
  const monthlyRevenue = Object.values(trendObj).map(t => ({
    month: t.label,
    revenue: t.total,
    service: t.service,
    boarding: t.boarding,
    product: t.product
  }))

  // 2. Service Mix (group by service_type)
  const serviceObj: Record<string, number> = {}
  appointmentsWithDetails.forEach(appt => {
    if (['Done', 'CheckOut'].includes(appt.status)) {
      const type = appt.service_type || 'Other'
      serviceObj[type] = (serviceObj[type] || 0) + (appt.price || 0)
    }
  })
  const serviceMix = Object.entries(serviceObj).map(([name, value]) => ({ name, value }))

  // 3. Groomer Performance
  const groomerObj: Record<string, number> = {}
  appointmentsWithDetails.forEach(appt => {
    if (['Done', 'CheckOut'].includes(appt.status) && appt.groomer?.name) {
      groomerObj[appt.groomer.name] = (groomerObj[appt.groomer.name] || 0) + (appt.price || 0)
    }
  })
  const groomerPerformance = Object.entries(groomerObj)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // 4. Low stock products
  const lowStockProducts = allProducts.filter(p => p.stock <= p.low_stock_threshold)

  // 5. Boarding metrics
  const checkoutsInPeriod = invoices.filter(inv => inv.boarding_reservation_id)
  const boardingStaysCount = checkoutsInPeriod.length
  
  let totalNightsBooked = 0
  checkoutsInPeriod.forEach(inv => {
    if (inv.boarding_reservation) {
      totalNightsBooked += inv.boarding_reservation.total_nights
    }
  })
  const avgStayDuration = boardingStaysCount > 0 ? Math.round((totalNightsBooked / boardingStaysCount) * 10) / 10 : 0
  const occupancyRate = roomsCount > 0 ? Math.round((occupiedRoomsCount / roomsCount) * 100) : 0

  // 6. Recent Sales
  const recentSales = await prisma.sale.findMany({
    where: startDate ? { tenantId, created: { gte: startDate } } : { tenantId },
    orderBy: { created: 'desc' },
    take: 10,
    include: {
      client: true,
      product: true
    }
  })

  // Calculate this month's revenue dynamically
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const thisMonthInvoiceSum = await prisma.invoice.aggregate({
    where: { tenantId, created: { gte: startOfMonth } },
    _sum: { total_amount: true }
  })
  const thisMonthRevenue = thisMonthInvoiceSum._sum.total_amount || 0

  const avgInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0

  return {
    monthlyRevenue,
    serviceMix,
    groomerPerformance,
    totalRevenue,
    totalServiceRevenue,
    totalBoardingRevenue,
    totalProductRevenue,
    thisMonthRevenue,
    avgInvoice,
    totalInvoices: invoices.length,
    paymentBreakdown,
    recentSales,
    lowStockProducts,
    boardingMetrics: {
      totalStays: boardingStaysCount,
      totalNights: totalNightsBooked,
      avgStayDuration,
      occupancyRate,
      occupiedRooms: occupiedRoomsCount,
      totalRooms: roomsCount
    }
  }
}

export async function getInvoices() {
  noStore()
  const tenantId = await getCurrentTenantId()
  return await prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { created: 'desc' },
    include: {
      client: true,
      appointment: {
        include: {
          pet: {
            include: { owner: true }
          }
        }
      },
      boarding_reservation: {
        include: {
          pet: {
            include: { owner: true }
          },
          room: true,
          appointments: { include: { groomer: true } },
          sales: { include: { product: true } }
        }
      },
      sales: {
        include: { product: true }
      }
    }
  })
}

// ─── Marketing / WhatsApp Broadcast ──────────────────────────────────────────

export async function getClientCount() {
  const tenantId = await getCurrentTenantId()
  return await prisma.client.count({
    where: { tenantId, whatsapp_number: { not: null } }
  })
}

export async function broadcastMessage(text: string) {
  const tenantId = await getCurrentTenantId()
  const clients = await prisma.client.findMany({
    where: { tenantId, whatsapp_number: { not: '' } },
    select: { whatsapp_number: true, name: true }
  })

  let successCount = 0
  
  for (const client of clients) {
    if (client.whatsapp_number) {
      const personalizedMsg = text.replace('{name}', client.name)
      const res = await sendWhatsApp(client.whatsapp_number, personalizedMsg)
      if (res) successCount++
      
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  return { successCount, total: clients.length }
}

export async function sendTestWhatsApp(phone: string) {
  const msg = `*PetFlow Connection Test* 🐾\n\nYour WhatsApp integration is now successfully connected! Petro is ready to assist your clients. 🚀`
  return await sendWhatsApp(phone, msg)
}

// ─── Chat History ────────────────────────────────────────────────────────────

export async function getChatSessions() {
  noStore()
  const tenantId = await getCurrentTenantId()
  return await prisma.chatSession.findMany({
    where: { tenantId },
    orderBy: { updated: 'desc' },
    include: {
      client: {
        select: {
          name: true,
          whatsapp_number: true
        }
      },
      messages: {
        orderBy: { created: 'desc' },
        take: 1
      }
    }
  })
}

export async function getChatMessages(sessionId: string) {
  noStore()
  return await prisma.chatMessage.findMany({
    where: { session_id: sessionId },
    orderBy: { created: 'asc' }
  })
}
export async function checkAgentStatus() {
  const config = await getWhatsAppConfig()
  const apiKey = process.env.PETFLOW_API_KEY
  
  if (!config?.agent_public_url || !apiKey) return { status: 'unknown' }

  try {
    const cleanUrl = config.agent_public_url.endsWith('/') ? config.agent_public_url.slice(0, -1) : config.agent_public_url
    const res = await fetch(`${cleanUrl}/health`, {
      headers: { 'x-api-key': apiKey },
      next: { revalidate: 0 }
    })
    
    if (res.ok) {
      return await res.json()
    }
    return { status: 'offline' }
  } catch (error) {
    console.error('Agent Health Check Error:', error)
    return { status: 'offline' }
  }
}

export async function toggleChatSessionPause(sessionId: string, isPaused: boolean) {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { is_paused: isPaused }
  })
  revalidatePath('/crm/chats')
}

export async function sendManualMessage(sessionId: string, phone: string, text: string) {
  // 1. Send the WhatsApp message using Evolution API
  await sendWhatsApp(phone, text)

  // 2. Save the message to DB with role 'assistant'
  await prisma.chatMessage.create({
    data: {
      session_id: sessionId,
      role: 'assistant',
      content: text
    }
  })

  // 3. Update the session's last message and updated timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      last_message: text.slice(0, 100),
      updated: new Date()
    }
  })

  revalidatePath('/crm/chats')
}

export async function addVaccinationRecord(data: {
  pet_id: string
  vaccine_name: string
  administered: Date
  due_date: Date
  status: string
  notes?: string
}) {
  const record = await prisma.vaccinationRecord.create({
    data: {
      pet_id: data.pet_id,
      vaccine_name: data.vaccine_name,
      administered: data.administered,
      due_date: data.due_date,
      status: data.status,
      notes: data.notes || null
    }
  })
  revalidatePath('/pets')
  return record
}

export async function deleteVaccinationRecord(id: string) {
  const record = await prisma.vaccinationRecord.delete({
    where: { id }
  })
  revalidatePath('/pets')
  return record
}

export async function logStockShipment(data: {
  productId: string
  quantity: number
  costPrice?: number
  notes?: string
}) {
  const product = await prisma.product.findUnique({ where: { id: data.productId } })
  if (!product) throw new Error('Product not found')

  const updated = await prisma.product.update({
    where: { id: data.productId },
    data: {
      stock: { increment: data.quantity },
      ...(data.costPrice !== undefined ? { cost_price: data.costPrice } : {})
    }
  })

  await prisma.stockLog.create({
    data: {
      product_id: data.productId,
      quantity: data.quantity,
      type: 'Replenishment',
      cost_price: data.costPrice ?? product.cost_price,
      notes: data.notes || 'Incoming shipment'
    }
  })

  revalidatePath('/inventory')
  return updated
}

export async function processRefund(invoiceId: string, returnItems: { saleId: string; quantity: number; returnToInventory: boolean }[]) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { sales: { include: { product: true } } }
  })
  if (!invoice) throw new Error('Invoice not found')

  let totalRefundAmount = 0
  let allFullyRefunded = true

  for (const item of returnItems) {
    const sale = invoice.sales.find(s => s.id === item.saleId)
    if (!sale) throw new Error('Sale item not found')

    const availableToRefund = sale.quantity - sale.refunded_quantity
    if (item.quantity > availableToRefund) {
      throw new Error(`Cannot refund more than available (${availableToRefund}) for ${sale.product.name}`)
    }

    // Update sale refunded quantity
    await prisma.sale.update({
      where: { id: item.saleId },
      data: { refunded_quantity: { increment: item.quantity } }
    })

    // If returning to inventory
    if (item.returnToInventory) {
      await prisma.product.update({
        where: { id: sale.product_id },
        data: { stock: { increment: item.quantity } }
      })

      await prisma.stockLog.create({
        data: {
          product_id: sale.product_id,
          quantity: item.quantity,
          type: 'Return',
          notes: `Returned from invoice ${invoice.invoice_number}`
        }
      })
    }

    const itemRefund = item.quantity * sale.unit_price
    totalRefundAmount += itemRefund
  }

  // Check if all sales are fully refunded
  const updatedSales = await prisma.sale.findMany({ where: { invoice_id: invoiceId } })
  for (const s of updatedSales) {
    if (s.refunded_quantity < s.quantity) {
      allFullyRefunded = false
    }
  }

  const newStatus = allFullyRefunded ? 'Refunded' : 'Partially Refunded'
  const newTotal = Math.max(0, invoice.total_amount - totalRefundAmount)

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: newStatus,
      total_amount: newTotal,
      invoice_notes: invoice.invoice_notes 
        ? `${invoice.invoice_notes} | Refunded ${totalRefundAmount} on ${new Date().toLocaleDateString()}`
        : `Refunded ${totalRefundAmount} on ${new Date().toLocaleDateString()}`
    }
  })

  revalidatePath('/billing')
  revalidatePath('/inventory')
  revalidatePath('/analytics')
  return updatedInvoice
}

export async function getProductStockLogs(productId: string) {
  return await prisma.stockLog.findMany({
    where: { product_id: productId },
    orderBy: { created: 'desc' }
  })
}

// ─── Campaigns / Marketing Segmentations ───────────────────────────────────────

export interface SegmentFilters {
  petSpecies?: string;
  inactiveDays?: string;
  minSpend?: string;
}

export async function getCampaigns() {
  const tenantId = await getCurrentTenantId()
  return await prisma.campaign.findMany({
    where: { tenantId },
    orderBy: { created: 'desc' },
    include: {
      logs: {
        select: { id: true }
      }
    }
  })
}

export async function createCampaign(data: { name: string; message: string; mediaUrl?: string; segmentFilters: any }) {
  const tenantId = await getCurrentTenantId()
  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      message: data.message,
      mediaUrl: data.mediaUrl || null,
      segmentFilters: data.segmentFilters,
      status: 'Draft',
      tenantId
    }
  })
  revalidatePath('/marketing')
  return campaign
}

export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({
    where: { id }
  })
  revalidatePath('/marketing')
  return { success: true }
}

function buildSegmentWhereClause(filters: SegmentFilters) {
  const { petSpecies = 'all', inactiveDays = 'all', minSpend } = filters;

  const whereClause: any = {
    AND: [
      { whatsapp_number: { not: null } },
      { whatsapp_number: { not: '' } }
    ]
  };

  if (petSpecies && petSpecies !== 'all') {
    whereClause.pets = {
      some: {
        species: {
          equals: petSpecies,
          mode: 'insensitive'
        }
      }
    };
  }

  if (minSpend && parseFloat(minSpend) > 0) {
    whereClause.total_spend = {
      gte: parseFloat(minSpend)
    };
  }

  if (inactiveDays && inactiveDays !== 'all') {
    const days = parseInt(inactiveDays, 10);
    if (!isNaN(days)) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);
      const thresholdStr = thresholdDate.toISOString().split('T')[0];

      // No pet of this client should have any appointment with date >= thresholdStr
      whereClause.AND.push({
        pets: {
          none: {
            appointments: {
              some: {
                appointment_date: {
                  gte: thresholdStr
                }
              }
            }
          }
        }
      });
    }
  }

  return whereClause;
}

export async function getSegmentedClients(filters: SegmentFilters) {
  const tenantId = await getCurrentTenantId()
  const whereClause = buildSegmentWhereClause(filters);
  whereClause.tenantId = tenantId
  const clients = await prisma.client.findMany({
    where: whereClause,
    include: {
      pets: {
        select: {
          pet_name: true,
          species: true,
          breed: true
        }
      }
    }
  });

  return clients;
}

export async function getSegmentedClientsCount(filters: SegmentFilters) {
  const tenantId = await getCurrentTenantId()
  const whereClause = buildSegmentWhereClause(filters);
  whereClause.tenantId = tenantId
  const count = await prisma.client.count({
    where: whereClause
  });
  return count;
}

export async function broadcastCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'Sending',
      sentCount: 0,
      failedCount: 0
    }
  });

  const filters = (campaign.segmentFilters || {}) as SegmentFilters;
  const allClients = await getSegmentedClients(filters);

  // ─── GDPR / DPDP: Only send to clients who have opted in to marketing ───────
  const clients = allClients.filter(c => c.marketing_opt_in === true)
  const skippedCount = allClients.length - clients.length

  if (skippedCount > 0) {
    console.log(`[Campaign ${campaignId}] Skipped ${skippedCount} client(s) without marketing opt-in.`)
  }

  // Compliance: opt-out footer appended to every campaign message
  const OPT_OUT_FOOTER = '\n\n_Reply STOP to unsubscribe from marketing messages._'

  let successCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    if (!client.whatsapp_number) continue;

    let personalizedMsg = campaign.message.replace(/{name}/g, client.name);
    const petName = client.pets[0]?.pet_name || 'your pet';
    personalizedMsg = personalizedMsg.replace(/{pet_name}/g, petName);

    // Always append opt-out footer (regulatory requirement)
    personalizedMsg = personalizedMsg + OPT_OUT_FOOTER

    try {
      let res;
      if (campaign.mediaUrl) {
        res = await sendWhatsAppMedia(client.whatsapp_number, campaign.mediaUrl, personalizedMsg);
      } else {
        res = await sendWhatsApp(client.whatsapp_number, personalizedMsg);
      }

      if (res && (res.status === 'success' || res.key || !res.error)) {
        successCount++;
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            clientName: client.name,
            phone: client.whatsapp_number,
            status: 'Sent'
          }
        });
      } else {
        errorCount++;
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            clientName: client.name,
            phone: client.whatsapp_number,
            status: 'Failed',
            error: res ? JSON.stringify(res) : 'Unknown response error'
          }
        });
      }
    } catch (error: any) {
      errorCount++;
      await prisma.campaignLog.create({
        data: {
          campaignId: campaign.id,
          clientName: client.name,
          phone: client.whatsapp_number,
          status: 'Failed',
          error: error.message || String(error)
        }
      });
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: successCount,
        failedCount: errorCount
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: successCount > 0 ? 'Completed' : 'Failed'
    }
  });

  revalidatePath('/marketing');

  return { successCount, failedCount: errorCount, skippedCount };
}


export async function getPetflowApiKey() {
  return process.env.PETFLOW_API_KEY || ''
}

export async function getAgentPublicUrl() {
  return process.env.AGENT_PUBLIC_URL || 'http://localhost:3002'
}


// Initialize the S3Client targeting Cloudflare R2 securely
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

/**
 * 🔐 Secure Server Action: Generates a short-lived presigned upload URL for Cloudflare R2.
 * Enforces secure key sanitization and Content-Type matching to prevent script injection.
 */
export async function getPresignedUploadUrl(fileName: string, contentType: string, folder: 'pets' | 'grooming' | 'marketing' | 'signatures' | 'boarding') {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 credentials are not configured on the server.')
  }

  // 1. Enforce strict Content-Type validation to ensure only images can be uploaded
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedMimeTypes.includes(contentType)) {
    throw new Error('Security Violation: Only image uploads (JPEG, PNG, WEBP, GIF) are allowed.')
  }

  // 2. Sanitize the filename to prevent directory traversal attacks
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg'
  
  // 3. Generate a cryptographically secure, unique storage key
  const uniqueId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const key = `${folder}/${uniqueId}.${safeExtension}`

  // 4. Generate the presigned URL command explicitly bound to the safe key and MIME type
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || 'petflow-assets',
    Key: key,
    ContentType: contentType,
  })

  // 5. Expire the link in 15 minutes (900 seconds) so it cannot be abused later
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 })

  // 6. Construct the public reading URL securely
  const publicDomain = process.env.R2_PUBLIC_CUSTOM_DOMAIN || `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com`
  const cleanPublicDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain
  const publicUrl = `${cleanPublicDomain}/${key}`

  return { uploadUrl, publicUrl }
}


// ─── Boarding Rooms ────────────────────────────────────────────────────────────

export async function getBoardingRooms() {
  const tenantId = await getCurrentTenantId()
  return await prisma.boardingRoom.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      reservations: {
        where: { status: { notIn: ['Cancelled', 'CheckedOut'] } },
        include: {
          pet: { include: { owner: true } },
          care_logs: { orderBy: { created_at: 'desc' } },
          appointments: { include: { groomer: true } },
          sales: { include: { product: true } }
        },
        orderBy: { check_in_date: 'asc' }
      }
    }
  })
}

export async function createBoardingRoom(data: {
  name: string
  room_type: string
  size_category: string
  pet_type: string
  price_per_night: number
  capacity?: number
  notes?: string | null
}) {
  const tenantId = await getCurrentTenantId()
  const room = await prisma.boardingRoom.create({ data: { ...data, tenantId } })
  revalidatePath('/boarding')
  return room
}

export async function updateBoardingRoom(id: string, data: {
  name?: string
  room_type?: string
  size_category?: string
  pet_type?: string
  price_per_night?: number
  capacity?: number
  status?: string
  notes?: string | null
}) {
  const room = await prisma.boardingRoom.update({ where: { id }, data })
  revalidatePath('/boarding')
  return room
}

export async function deleteBoardingRoom(id: string) {
  // Cancel all future reservations first
  await prisma.boardingReservation.updateMany({
    where: { room_id: id, status: { in: ['Reserved', 'CheckedIn'] } },
    data: { status: 'Cancelled' }
  })
  await prisma.boardingRoom.delete({ where: { id } })
  revalidatePath('/boarding')
}

// ─── Boarding Reservations ────────────────────────────────────────────────────

export async function getBoardingReservations(filter?: 'upcoming' | 'active' | 'past' | 'all') {
  const tenantId = await getCurrentTenantId()
  const today = new Date().toISOString().split('T')[0]
  let where: any = { tenantId }

  if (filter === 'upcoming') {
    where = { tenantId, check_in_date: { gt: today }, status: { notIn: ['Cancelled'] } }
  } else if (filter === 'active') {
    where = { tenantId, status: 'CheckedIn' }
  } else if (filter === 'past') {
    where = { tenantId, status: { in: ['CheckedOut', 'Cancelled'] } }
  }

  return await prisma.boardingReservation.findMany({
    where,
    include: {
      room: true,
      pet: { include: { owner: true } },
      care_logs: {
        orderBy: { created_at: 'desc' }
      },
      appointments: { include: { groomer: true } },
      sales: { include: { product: true } }
    },
    orderBy: { check_in_date: 'desc' }
  })
}

export async function createBoardingReservation(data: {
  room_id: string
  pet_id: string
  check_in_date: string
  check_out_date: string
  total_nights: number
  total_amount: number
  special_notes?: string | null
  feeding_notes?: string | null
  medication_notes?: string | null
  emergency_contact?: string | null
}) {
  const tenantId = await getCurrentTenantId()
  const settings = await prisma.settings.findFirst({ where: { tenantId } })
  const currencySymbol = settings?.currency_symbol || '₹'
  // Check for conflicts — same room, overlapping dates, not cancelled
  const conflict = await prisma.boardingReservation.findFirst({
    where: {
      tenantId,
      room_id: data.room_id,
      status: { notIn: ['Cancelled', 'CheckedOut'] },
      AND: [
        { check_in_date:  { lt: data.check_out_date } },
        { check_out_date: { gt: data.check_in_date  } },
      ]
    }
  })
  if (conflict) throw new Error('This room is already booked for the selected dates.')

  const reservation = await prisma.boardingReservation.create({
    data: { ...data, tenantId },
    include: { pet: { include: { owner: true } }, room: true }
  })

  // Send WhatsApp confirmation
  const whatsapp = reservation.pet?.owner?.whatsapp_number
  if (whatsapp) {
    const msg = `🏠 *Boarding Confirmed!*\n\nHi ${reservation.pet.owner.name}, *${reservation.pet.pet_name}*'s stay at PetFlow Spa is confirmed!\n\n📅 Check-in: ${data.check_in_date}\n📅 Check-out: ${data.check_out_date}\n🌙 Nights: ${data.total_nights}\n💰 Total: ${currencySymbol}${data.total_amount}\n\nWe'll take great care of them! 🐾`
    sendWhatsApp(whatsapp, msg).catch(err => console.error('WhatsApp boarding confirmation error:', err))
  }

  revalidatePath('/boarding')
  return reservation
}

export async function updateBoardingReservation(id: string, data: {
  room_id?: string
  status?: string
  payment_status?: string
  payment_method?: string | null
  special_notes?: string | null
  feeding_notes?: string | null
  medication_notes?: string | null
  emergency_contact?: string | null
  check_in_date?: string
  check_out_date?: string
  total_nights?: number
  total_amount?: number
  check_in_weight?: number | null
  check_in_belongings?: string | null
  check_in_health?: string | null
  check_in_signature?: string | null
}) {
  const reservation = await prisma.boardingReservation.update({
    where: { id },
    data,
    include: { pet: { include: { owner: true } }, room: true }
  })

  // WhatsApp on check-in
  if (data.status === 'CheckedIn' && reservation.pet?.owner?.whatsapp_number) {
    const weightText = reservation.check_in_weight ? `\n⚖️ Weight: ${reservation.check_in_weight} kg` : ''
    const belongingsText = reservation.check_in_belongings ? `\n🎒 Belongings: ${reservation.check_in_belongings}` : ''
    const healthText = reservation.check_in_health ? `\n🩺 Health Notes: ${reservation.check_in_health}` : ''
    const roomName = reservation.room?.name || 'their room'

    const msg = `🏠 *Checked In Successfully!*\n\nHi ${reservation.pet.owner.name}, *${reservation.pet.pet_name}* has checked in to room *${roomName}*!${weightText}${belongingsText}${healthText}\n\nWe will take great care of them! 🐾`
    sendWhatsApp(reservation.pet.owner.whatsapp_number, msg).catch(err => console.error('WhatsApp check-in error:', err))
  }

  // WhatsApp on check-out
  if (data.status === 'CheckedOut' && reservation.pet?.owner?.whatsapp_number) {
    const msg = `🐾 *Checkout Complete!*\n\nHi ${reservation.pet.owner.name}, *${reservation.pet.pet_name}* has checked out and is ready to go home! Thank you for choosing PetFlow Spa. We hope to see you again soon! ✨`
    sendWhatsApp(reservation.pet.owner.whatsapp_number, msg).catch(err => console.error('WhatsApp checkout error:', err))
  }

  revalidatePath('/boarding')
  return reservation
}

export async function updateBoardingPaymentStatus(id: string, paymentStatus: string) {
  const res = await prisma.boardingReservation.update({
    where: { id },
    data: { payment_status: paymentStatus }
  })
  revalidatePath('/boarding')
  return res
}

export async function deleteBoardingReservation(id: string) {
  await prisma.boardingReservation.delete({ where: { id } })
  revalidatePath('/boarding')
}

export async function addBoardingCareLog(data: {
  reservation_id: string
  activity_type: string
  status: string
  notes?: string | null
  photo_url?: string | null
  logged_by?: string | null
  send_whatsapp?: boolean
}) {
  const log = await prisma.boardingCareLog.create({
    data: {
      reservation_id: data.reservation_id,
      date: new Date().toISOString().split('T')[0],
      activity_type: data.activity_type,
      status: data.status,
      notes: data.notes || null,
      photo_url: data.photo_url || null,
      logged_by: data.logged_by || 'Staff'
    }
  })

  // Send WhatsApp update if toggled
  if (data.send_whatsapp) {
    const reservation = await prisma.boardingReservation.findUnique({
      where: { id: data.reservation_id },
      include: { pet: { include: { owner: true } }, room: true }
    })

    if (reservation?.pet?.owner?.whatsapp_number) {
      let emoji = '📋'
      if (data.activity_type === 'Feeding') emoji = '🍖'
      else if (data.activity_type === 'Medication') emoji = '💊'
      else if (data.activity_type === 'Potty') emoji = '🌳'
      else if (data.activity_type === 'Mood') emoji = '✨'

      const ownerName = reservation.pet.owner.name
      const petName = reservation.pet.pet_name
      
      let msg = `📢 *${petName}'s Daily Care Update!* 🐾\n\nHi ${ownerName}, here is ${petName}'s care log update:\n\n${emoji} *Activity:* ${data.activity_type}\n✅ *Status:* ${data.status}`
      if (data.notes) {
        msg += `\n📝 *Notes:* ${data.notes}`
      }
      if (data.photo_url) {
        msg += `\n\n📸 *Photo:* ${data.photo_url}`
      }
      msg += `\n\nWe'll keep you posted! ❤️`

      sendWhatsApp(reservation.pet.owner.whatsapp_number, msg).catch(err => 
        console.error('WhatsApp care update error:', err)
      )
    }
  }

  revalidatePath('/boarding')
  return log
}

export async function addBoardingServiceAddon(data: {
  reservation_id: string
  service_type: string
  price: number
  groomer_id: string | null
  appointment_date: string
  appointment_time: string
}) {
  const reservation = await prisma.boardingReservation.findUnique({
    where: { id: data.reservation_id }
  })
  if (!reservation) throw new Error('Boarding reservation not found')

  const tenantId = reservation.tenantId

  const appt = await prisma.appointment.create({
    data: {
      tenantId,
      pet_id: reservation.pet_id,
      groomer_id: data.groomer_id,
      service_type: data.service_type,
      price: data.price,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      boarding_reservation_id: data.reservation_id,
      status: 'Booked',
      payment_status: 'Pending'
    }
  })

  revalidatePath('/boarding')
  return appt
}

export async function addBoardingProductAddon(data: {
  reservation_id: string
  product_id: string
  quantity: number
}) {
  const reservation = await prisma.boardingReservation.findUnique({
    where: { id: data.reservation_id },
    include: { pet: true }
  })
  if (!reservation) throw new Error('Boarding reservation not found')

  const product = await prisma.product.findUnique({
    where: { id: data.product_id }
  })
  if (!product) throw new Error('Product not found')
  if (product.stock < data.quantity) {
    throw new Error(`Insufficient stock. Only ${product.stock} units of ${product.name} left.`)
  }

  const tenantId = reservation.tenantId

  // 1. Decrement stock
  await prisma.product.update({
    where: { id: data.product_id },
    data: { stock: { decrement: data.quantity } }
  })

  // 2. Log stock movement
  await prisma.stockLog.create({
    data: {
      product_id: data.product_id,
      quantity: -data.quantity,
      type: 'Sale',
      notes: `Sold as add-on during boarding stay (${reservation.pet.pet_name})`
    }
  })

  // 3. Create Sale entry linked to boarding
  const sale = await prisma.sale.create({
    data: {
      tenantId,
      client_id: reservation.pet.owner_id,
      product_id: data.product_id,
      quantity: data.quantity,
      unit_price: product.retail_price,
      total_price: product.retail_price * data.quantity,
      boarding_reservation_id: data.reservation_id
    }
  })

  revalidatePath('/boarding')
  return sale
}

export async function updateUserAccount(userId: string, data: {
  name: string
  email: string
  password?: string
}) {
  if (!userId) throw new Error('Unauthorized')

  // Check if email is already taken by another user
  const existing = await prisma.user.findFirst({
    where: {
      email: data.email,
      id: { not: userId }
    }
  })
  if (existing) {
    throw new Error('Email is already in use by another account.')
  }

  const updateData: any = {
    name: data.name,
    email: data.email,
  }

  if (data.password && data.password.trim() !== '') {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData
  })

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
  }
}

// ─── Vans (Mobile Fleet) ──────────────────────────────────────────────────────

export async function getVans() {
  noStore()
  const tenantId = await getCurrentTenantId()
  return await prisma.van.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  })
}

export async function createVan(data: { name: string; plate_number?: string; status?: string }) {
  const tenantId = await getCurrentTenantId()
  const van = await prisma.van.create({
    data: {
      ...data,
      tenantId
    }
  })
  revalidatePath('/settings')
  return van
}

export async function updateVan(id: string, data: Partial<{ name: string; plate_number: string; status: string }>) {
  const van = await prisma.van.update({
    where: { id },
    data
  })
  revalidatePath('/settings')
  return van
}

export async function deleteVan(id: string) {
  const van = await prisma.van.delete({
    where: { id }
  })
  revalidatePath('/settings')
  return van
}



