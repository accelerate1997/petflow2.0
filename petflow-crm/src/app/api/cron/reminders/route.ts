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
    
    // Find appointments happening in exactly ~2 hours
    // We look for appointments today where current time + 2 hours matches appointment_time
    const targetTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const hour = targetTime.getHours().toString().padStart(2, '0');
    const minute = targetTime.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hour}:${minute}`;

    const todayStr = now.toISOString().split('T')[0];

    const appointments = await prisma.appointment.findMany({
      where: {
        appointment_date: todayStr,
        appointment_time: {
          startsWith: `${hour}:` // Matches current hour + 2
        },
        status: 'Booked'
      },
      include: {
        pet: { include: { owner: true } }
      }
    });

    let sentCount = 0;
    for (const appt of appointments) {
      if (appt.pet?.owner?.whatsapp_number) {
        const msg = `*Appointment Reminder!* 🐾\n\nHi ${appt.pet.owner.name}, this is a friendly reminder that *${appt.pet.pet_name}* has an appointment in about 2 hours (${appt.appointment_time}). See you soon!`;
        // Pass tenantId so each spa's WhatsApp instance is used
        await sendWhatsApp(appt.pet.owner.whatsapp_number, msg, appt.tenantId || undefined);
        sentCount++;
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (error) {
    console.error('Cron Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process reminders' }, { status: 500 });
  }
}
