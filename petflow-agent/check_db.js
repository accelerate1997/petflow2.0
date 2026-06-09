const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  console.log('Current WhatsApp Config:', JSON.stringify(config, null, 2));
  const settings = await prisma.settings.findFirst();
  console.log('Current Settings:', JSON.stringify(settings, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
