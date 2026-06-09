import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@petflow.com'
  const password = process.env.ADMIN_PASSWORD
  
  if (!password) {
    console.error('❌ ADMIN_PASSWORD environment variable is required to run seeding.')
    process.exit(1)
  }

  console.log('Hashing password...')
  const hashedPassword = await bcrypt.hash(password, 10)

  console.log('Seeding user to database...')
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
    },
    create: {
      email,
      name: 'System Admin',
      password: hashedPassword,
      role: 'SuperAdmin',
    },
  })

  console.log('Seeded initial admin user successfully:', user.email)
}

main()
  .catch((e) => {
    console.error('Error seeding admin user:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
