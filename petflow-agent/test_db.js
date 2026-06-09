const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const clients = await prisma.client.count();
    const settings = await prisma.settings.findFirst();
    console.log('✅ Connected to database!');
    console.log(`📊 Client count: ${clients}`);
    console.log(`🏥 Spa name: ${settings?.spa_name || 'Not set'}`);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
