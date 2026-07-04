import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Simple security check (use a secret in production)
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    
    // 1. Update status to 'Overdue' for all records where due_date < now and status !== 'Overdue'
    await prisma.vaccinationRecord.updateMany({
      where: {
        due_date: { lt: now },
        status: { not: 'Overdue' }
      },
      data: { status: 'Overdue' }
    });

    // 2. Update status to 'Due Soon' for all records where due_date >= now and due_date <= now + 14 days and status !== 'Due Soon'
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await prisma.vaccinationRecord.updateMany({
      where: {
        due_date: {
          gte: now,
          lte: fourteenDaysFromNow
        },
        status: { not: 'Due Soon' }
      },
      data: { status: 'Due Soon' }
    });

    // 3. Find records where booster is due exactly in 14 days
    const targetMin = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 0, 0, 0);
    const targetMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 23, 59, 59);

    const upcomingBoosterRecords = await prisma.vaccinationRecord.findMany({
      where: {
        due_date: {
          gte: targetMin,
          lte: targetMax
        }
      },
      include: {
        pet: {
          include: {
            owner: true
          }
        }
      }
    });

    let sentCount = 0;
    for (const record of upcomingBoosterRecords) {
      if (record.pet?.owner?.whatsapp_number) {
        const ownerName = record.pet.owner.name;
        const petName = record.pet.pet_name;
        const vaccineName = record.vaccine_name;
        const dueDateFormatted = record.due_date.toISOString().split('T')[0];

        const message = `*Vaccination Due Soon!* 💉🐾\n\nHi ${ownerName}, this is a friendly reminder from PetFlow Spa that *${petName}*'s *${vaccineName}* booster is due soon on *${dueDateFormatted}*.\n\nKeep them safe and healthy! You can schedule their next visit here: [Booking Link]`;
        
        await sendWhatsApp(record.pet.owner.whatsapp_number, message, record.pet.tenantId || undefined);
        sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      statusesUpdated: true,
      alertsSent: sentCount
    });
  } catch (error) {
    console.error('Vaccine Cron Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process vaccine reminders' }, { status: 500 });
  }
}
