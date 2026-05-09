import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma || (() => {
  const connectionString = process.env.DATABASE_URL
  
  // During build, if DATABASE_URL is missing or we are pre-rendering, 
  // we want to avoid crashing if possible.
  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
})()
