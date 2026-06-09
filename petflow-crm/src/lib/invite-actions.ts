'use server'

import { prisma } from './prisma'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// Helper to initialize default config records for a brand new Tenant
async function initializeTenantConfigs(tenantId: string, spaName: string) {
  // 1. Settings
  await prisma.settings.create({
    data: {
      tenantId,
      spa_name: spaName,
      primary_color: '#89A894',
      secondary_color: '#6d8f7a',
      accent_color: '#e8f0eb',
    }
  })

  // 2. WhatsAppConfig
  await prisma.whatsAppConfig.create({
    data: {
      tenantId,
      spa_name: spaName,
    }
  })

  // 3. PetroConfig (AI Configuration)
  await prisma.petroConfig.create({
    data: {
      tenantId,
      agent_name: 'Petro',
    }
  })

  // 4. PaymentConfig
  await prisma.paymentConfig.create({
    data: {
      tenantId,
      default_provider: 'razorpay',
    }
  })
}

// ─── Create Staff Invite ──────────────────────────────────────────────────────

export async function createStaffInvite(invitedBy: string, email: string, role: string = 'Staff') {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')

  const normalizedEmail = email.trim().toLowerCase()

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existingUser) throw new Error('A user with this email already exists.')

  // Check if there's already a pending (unused, unexpired) invite for this email
  const existing = await prisma.staffInvite.findFirst({
    where: {
      email: normalizedEmail,
      used_at: null,
      expires_at: { gt: new Date() },
    }
  })
  if (existing) throw new Error('A pending invite already exists for this email.')

  const token = randomBytes(32).toString('hex')
  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  const inviterRole = (session.user as any).role
  const inviterTenantId = (session.user as any).tenantId

  let targetTenantId = inviterTenantId

  // If a SuperAdmin invites a SpaAdmin, it represents a BRAND NEW Spa onboarding (new tenant)
  if (inviterRole === 'SuperAdmin' && role === 'SpaAdmin') {
    const spaName = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ') + ' Spa'
    const newTenant = await prisma.tenant.create({
      data: {
        name: spaName,
      }
    })
    targetTenantId = newTenant.id
    // Initialize default settings/configs for this new tenant
    await initializeTenantConfigs(newTenant.id, spaName)
  }

  const invite = await prisma.staffInvite.create({
    data: {
      tenantId: targetTenantId,
      email: normalizedEmail,
      token,
      role,
      expires_at,
      invited_by: (session.user as any).id,
    }
  })

  revalidatePath('/staff')
  return invite
}

// ─── Get All Invites (for Staff page) ────────────────────────────────────────

export async function getStaffInvites() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')
  const tenantId = (session.user as any).tenantId

  // SuperAdmins can see all invites on the platform. Other admins see only their tenant invites.
  const where = (session.user as any).role === 'SuperAdmin' ? {} : { tenantId }

  return await prisma.staffInvite.findMany({
    where,
    orderBy: { created: 'desc' },
    include: { inviter: { select: { name: true } } }
  })
}

// ─── Revoke an Invite ────────────────────────────────────────────────────────

export async function revokeStaffInvite(inviteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')

  // SuperAdmins can delete any invite. Others are restricted to their tenant.
  const tenantId = (session.user as any).tenantId
  const invite = await prisma.staffInvite.findUnique({ where: { id: inviteId } })
  if (!invite) throw new Error('Invite not found')

  if ((session.user as any).role !== 'SuperAdmin' && invite.tenantId !== tenantId) {
    throw new Error('Unauthorized')
  }

  await prisma.staffInvite.delete({ where: { id: inviteId } })
  revalidatePath('/staff')
}

// ─── Validate Token (called from the public register page) ──────────────────

export async function validateInviteToken(token: string) {
  const invite = await prisma.staffInvite.findUnique({ where: { token } })

  if (!invite) return { valid: false, error: 'This invite link is invalid.' }
  if (invite.used_at) return { valid: false, error: 'This invite link has already been used.' }
  if (invite.expires_at < new Date()) return { valid: false, error: 'This invite link has expired.' }

  return { valid: true, invite }
}

// ─── Register Via Invite ──────────────────────────────────────────────────────

export async function registerViaInvite(token: string, name: string, password: string) {
  const { valid, invite, error } = await validateInviteToken(token)
  if (!valid || !invite) throw new Error(error || 'Invalid invite.')

  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user account under the invite's tenantId
  const user = await prisma.user.create({
    data: {
      tenantId: invite.tenantId,
      name: name.trim(),
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
    }
  })

  // If role is 'Staff', also create a Staff profile record automatically so they are visible in scheduling and staff lists!
  if (invite.role === 'Staff') {
    await prisma.staff.create({
      data: {
        tenantId: invite.tenantId,
        name: name.trim(),
        email: invite.email,
        role: 'Groomer', // default role
        status: 'Active',
        working_hours: {
          monday: { is_working: true, start: '09:00', end: '18:00' },
          tuesday: { is_working: true, start: '09:00', end: '18:00' },
          wednesday: { is_working: true, start: '09:00', end: '18:00' },
          thursday: { is_working: true, start: '09:00', end: '18:00' },
          friday: { is_working: true, start: '09:00', end: '18:00' },
          saturday: { is_working: true, start: '09:00', end: '18:00' },
          sunday: { is_working: false, start: '09:00', end: '18:00' }
        }
      }
    })
  }

  // Mark invite as used
  await prisma.staffInvite.update({
    where: { id: invite.id },
    data: { used_at: new Date() }
  })

  return { success: true, email: user.email }
}
