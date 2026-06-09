import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenantId = 'default-tenant-id'

  console.log('1. Creating Default Tenant...')
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Default Spa',
      domain: 'localhost',
    },
  })
  console.log('Default Tenant verified:', tenant.id)

  console.log('2. Migrating Settings...')
  // Settings
  const settingsCount = await prisma.settings.count()
  if (settingsCount > 0) {
    await prisma.settings.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    })
  } else {
    // Create one if it doesn't exist
    await prisma.settings.create({
      data: {
        tenantId,
        spa_name: 'Default Spa',
      },
    })
  }

  console.log('3. Migrating WhatsAppConfig...')
  const waCount = await prisma.whatsAppConfig.count()
  if (waCount > 0) {
    await prisma.whatsAppConfig.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    })
  } else {
    await prisma.whatsAppConfig.create({
      data: {
        tenantId,
        spa_name: 'Default Spa',
      },
    })
  }

  console.log('4. Migrating Users...')
  await prisma.user.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('5. Migrating Clients...')
  await prisma.client.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('6. Migrating Pets...')
  await prisma.pet.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('7. Migrating Services...')
  await prisma.service.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('8. Migrating Products...')
  await prisma.product.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('9. Migrating Staff...')
  await prisma.staff.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('10. Migrating Appointments...')
  await prisma.appointment.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('11. Migrating Invoices...')
  await prisma.invoice.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('12. Migrating Sales...')
  await prisma.sale.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('13. Migrating ChatSessions...')
  await prisma.chatSession.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('14. Migrating Campaigns...')
  await prisma.campaign.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('15. Migrating PetroConfigs...')
  const petroCount = await prisma.petroConfig.count()
  if (petroCount > 0) {
    await prisma.petroConfig.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    })
  } else {
    await prisma.petroConfig.create({
      data: {
        tenantId,
        agent_name: 'Petro',
      },
    })
  }

  console.log('16. Migrating BoardingRooms...')
  await prisma.boardingRoom.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('17. Migrating BoardingReservations...')
  await prisma.boardingReservation.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('18. Migrating StaffInvites...')
  await prisma.staffInvite.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('19. Migrating PaymentLinks...')
  await prisma.paymentLink.updateMany({
    where: { tenantId: null },
    data: { tenantId },
  })

  console.log('20. Migrating PaymentConfigs...')
  const payCount = await prisma.paymentConfig.count()
  if (payCount > 0) {
    await prisma.paymentConfig.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    })
  } else {
    await prisma.paymentConfig.create({
      data: {
        tenantId,
        default_provider: 'razorpay',
      },
    })
  }

  console.log('🎉 Migration successful! All existing records assigned to Default Tenant.')
}

main()
  .catch((e) => {
    console.error('Error during tenant migration:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
