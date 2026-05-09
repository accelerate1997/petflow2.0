'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(search?: string) {
  return await prisma.client.findMany({
    where: search ? {
      name: { contains: search, mode: 'insensitive' }
    } : undefined,
    include: { pets: true },
    orderBy: { created: 'desc' }
  })
}

export async function createClient(data: any) {
  const client = await prisma.client.create({ data })
  revalidatePath('/clients')
  return client
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } })
  revalidatePath('/clients')
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

export async function getPets() {
  return await prisma.pet.findMany({
    include: { owner: true },
    orderBy: { created: 'desc' }
  })
}

export async function createPet(data: any) {
  const pet = await prisma.pet.create({ data })
  revalidatePath('/pets')
  return pet
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getServices() {
  return await prisma.service.findMany({
    orderBy: { service_name: 'asc' }
  })
}

export async function createService(data: any) {
  const service = await prisma.service.create({ data })
  revalidatePath('/services')
  return service
}

export async function deleteService(id: string) {
  await prisma.service.delete({ where: { id } })
  revalidatePath('/services')
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(view: 'today' | 'tomorrow' | 'week' | 'all' = 'all') {
  let where: any = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

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
      } 
    },
    orderBy: [
      { appointment_date: 'asc' },
      { appointment_time: 'asc' }
    ]
  })
}

export async function createAppointment(data: any) {
  const appt = await prisma.appointment.create({ data })
  revalidatePath('/appointments')
  revalidatePath('/crm')
  revalidatePath('/dashboard')
  return appt
}

export async function updateAppointmentStatus(id: string, status: string) {
  await prisma.appointment.update({
    where: { id },
    data: { status }
  })
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

// ─── Settings & Config ────────────────────────────────────────────────────────

export async function getSettings() {
  return await prisma.settings.findFirst()
}

export async function updateSettings(id: string | null, data: any) {
  if (id) {
    await prisma.settings.update({ where: { id }, data })
  } else {
    await prisma.settings.create({ data })
  }
  revalidatePath('/settings')
}

export async function getWhatsAppConfig() {
  return await prisma.whatsAppConfig.findFirst()
}

export async function updateWhatsAppConfig(id: string | null, data: any) {
  if (id) {
    await prisma.whatsAppConfig.update({ where: { id }, data })
  } else {
    await prisma.whatsAppConfig.create({ data })
  }
  revalidatePath('/settings')
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [petCount, clients, appointments] = await Promise.all([
    prisma.pet.count(),
    prisma.client.findMany({ select: { total_spend: true, join_date: true, created: true } }),
    prisma.appointment.findMany({
      where: { 
        created: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } 
      },
      select: { price: true, status: true, created: true }
    })
  ])

  return { petCount, clients, appointments }
}
