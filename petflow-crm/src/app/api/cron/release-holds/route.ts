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
    const configs = await prisma.paymentConfig.findMany({
      where: {
        partial_payment_enabled: true
      }
    });

    let expiredCount = 0;

    for (const config of configs) {
      const tenantId = config.tenantId;
      if (!tenantId) continue;

      const holdMinutes = config.partial_payment_hold || 30;
      const expirationThreshold = new Date(Date.now() - holdMinutes * 60 * 1000);

      // Find all appointments in 'PendingPayment' status created before the threshold
      const expiredAppointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          status: 'PendingPayment',
          created: { lt: expirationThreshold }
        },
        include: {
          pet: { include: { owner: true } },
          invoice: true
        }
      });

      for (const appt of expiredAppointments) {
        // Update appointment status to Cancelled
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { status: 'Cancelled', notes: appt.notes ? `${appt.notes} (Hold expired)` : 'Hold expired' }
        });

        // Cancel associated payment links and mark invoice void
        if (appt.invoice) {
          await prisma.invoice.update({
            where: { id: appt.invoice.id },
            data: { status: 'Void' }
          });

          await prisma.paymentLink.updateMany({
            where: { invoice_id: appt.invoice.id, status: 'created' },
            data: { status: 'cancelled' }
          });
        }

        // Notify client via WhatsApp
        if (appt.pet?.owner?.whatsapp_number) {
          const clientName = appt.pet.owner.name;
          const petName = appt.pet.pet_name;
          const settings = await prisma.settings.findFirst({ where: { tenantId } });
          const spaName = settings?.spa_name || 'PetFlow Spa';
          const msg = `🐾 *Booking Hold Released*\n\nHi ${clientName},\n\nThe temporary hold on your appointment for *${petName}* on *${appt.appointment_date}* at *${appt.appointment_time}* has expired as the deposit was not received.\n\nThe slot has been released. If you still wish to book, please contact *${spaName}* or chat with us again to hold a new slot. Thank you! ✨`;
          
          await sendWhatsApp(appt.pet.owner.whatsapp_number, msg, tenantId);
        }

        expiredCount++;
      }
    }

    return NextResponse.json({
      success: true,
      releasedHolds: expiredCount
    });
  } catch (error) {
    console.error('Release Holds Cron Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to release expired holds' }, { status: 500 });
  }
}
