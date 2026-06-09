import { headers } from 'next/headers'
import { prisma } from './prisma'

export async function getTenantFromHost() {
  try {
    const headersList = await headers()
    const host = headersList.get('host') || ''
    
    // Split port if running locally (e.g. localhost:3000 -> localhost)
    const cleanHost = host.split(':')[0]

    // If local or dev fallback
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '192.168.1.135') {
      return await prisma.tenant.findUnique({
        where: { id: 'default-tenant-id' },
        include: { settings: true }
      })
    }

    // Try to find the tenant by custom domain
    const tenant = await prisma.tenant.findUnique({
      where: { domain: cleanHost },
      include: { settings: true }
    })

    if (tenant) return tenant

    // Global platform fallback
    return await prisma.tenant.findUnique({
      where: { id: 'default-tenant-id' },
      include: { settings: true }
    })
  } catch (error) {
    console.error('Error detecting tenant from host:', error)
    // Absolute fallback
    return await prisma.tenant.findUnique({
      where: { id: 'default-tenant-id' },
      include: { settings: true }
    })
  }
}
