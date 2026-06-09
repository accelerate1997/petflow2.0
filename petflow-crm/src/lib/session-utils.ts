import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'

/**
 * Gets the current user's tenantId from their session.
 * Throws if no session found (unauthorized).
 */
export async function getCurrentTenantId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')
  const tenantId = (session.user as any).tenantId
  if (!tenantId) throw new Error('No tenant associated with this account.')
  return tenantId
}

/**
 * Gets the full session user object.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Unauthorized')

  const userId = (session.user as any).id
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true }
    })
    if (dbUser?.status === 'Inactive') {
      redirect('/unauthorized')
    }
  }

  return session.user as any
}
