import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prismaClient: PrismaClient | undefined }

export const prisma = globalForPrisma.prismaClient || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaClient = prisma
