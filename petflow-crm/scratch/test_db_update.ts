import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const appts = await prisma.appointment.findMany({ take: 1 })
  if (appts.length === 0) {
    console.log('No appointments found')
    return
  }
  
  const id = appts[0].id
  console.log(`Found appointment: ${id}, current payment: ${appts[0].payment_status}`)
  
  const updated = await prisma.appointment.update({
    where: { id },
    data: { payment_status: 'UPI' }
  })
  
  console.log(`Updated! New status: ${updated.payment_status}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
