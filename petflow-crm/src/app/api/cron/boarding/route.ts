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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    console.log(`⏰ Running: Boarding Check-In Reminders for check-in date: ${tomorrowStr}`);

    const reservations = await prisma.boardingReservation.findMany({
      where: {
        check_in_date: tomorrowStr,
        status: 'Reserved'
      },
      include: {
        pet: {
          include: {
            owner: true
          }
        },
        room: true
      }
    });

    let sentCount = 0;
    for (const res of reservations) {
      if (res.pet?.owner?.whatsapp_number) {
        const ownerName = res.pet.owner.name;
        const petName = res.pet.pet_name;
        const roomName = res.room.name;
        const checkInDate = res.check_in_date;

        const message = `*Boarding Check-In Reminder!* 🏨🐾\n\nHi ${ownerName}, this is a friendly reminder that *${petName}* is scheduled for check-in tomorrow (${checkInDate}) for their boarding stay in room *${roomName}*.\n\n🎒 *Quick Checklist:*\n- Please bring their favorite food (divided by portion if possible).\n- Bring any daily medications with clear dosage instructions.\n- Don't forget their updated vaccination record.\n\nWe look forward to hosting them! ✨`;

        await sendWhatsApp(res.pet.owner.whatsapp_number, message, res.tenantId || undefined);
        sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      checkInDate: tomorrowStr,
      remindersSent: sentCount
    });
  } catch (error: any) {
    console.error('Boarding Cron Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process boarding reminders' }, { status: 500 });
  }
}
