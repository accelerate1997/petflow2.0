import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://pbpetflow.elevetoai.com/');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrate() {
  console.log('🚀 Starting migration...');

  const collections = [
    { name: 'clients', model: prisma.client },
    { name: 'pets', model: prisma.pet },
    { name: 'services', model: prisma.service },
    { name: 'appointments', model: prisma.appointment },
    { name: 'settings', model: prisma.settings },
    { name: 'whatsapp_config', model: prisma.whatsAppConfig },
  ];

  for (const coll of collections) {
    try {
      console.log(`📦 Migrating ${coll.name}...`);
      const records = await pb.collection(coll.name).getFullList();
      console.log(`  Found ${records.length} records in ${coll.name}.`);

      for (const record of records) {
        const data: any = {};
        
        // Only copy fields that exist in the Prisma model
        // We'll use a whitelist of fields we know
        const fields = Object.keys(record);
        for (const field of fields) {
          if (['collectionId', 'collectionName', 'expand'].includes(field)) continue;
          
          let targetField = field;
          if (field === 'thumnail') targetField = 'thumbnail'; // Fix typo in PB data
          
          data[targetField] = record[field];
        }

        // Transform dates
        if (data.created) data.created = new Date(data.created);
        if (data.updated) data.updated = new Date(data.updated);
        if (coll.name === 'clients') {
          if (data.join_date && data.join_date !== '') {
            data.join_date = new Date(data.join_date);
          } else {
            delete data.join_date; // Let it use default or be null
          }
        }

        await (coll.model as any).upsert({
          where: { id: record.id },
          update: data,
          create: { id: record.id, ...data },
        });
      }
      console.log(`✅ Migrated ${coll.name}.`);
    } catch (error: any) {
      console.error(`❌ Failed to migrate ${coll.name}:`, error.message);
      if (error.status === 404) {
        console.log(`  Tip: Collection "${coll.name}" might not exist in PocketBase.`);
      }
    }
  }

  console.log('🎉 Migration run finished!');
}

migrate();
