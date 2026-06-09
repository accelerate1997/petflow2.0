const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendMessage } = require('./evolution');

const prisma = new PrismaClient();

async function initAutomation() {
    console.log('📅 Automation Service Initialized');

    // 1. Tomorrow's Reminders (Every day at 10:00 AM)
    cron.schedule('0 10 * * *', async () => {
        console.log('⏰ Running: Tomorrow\'s Appointment Reminders');
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const appointments = await prisma.appointment.findMany({
                where: {
                    appointment_date: tomorrowStr,
                    status: 'Booked',
                },
                include: {
                    pet: {
                        include: { owner: true }
                    }
                }
            });

            for (const appt of appointments) {
                if (appt.pet?.owner?.whatsapp_number) {
                    const msg = `*Appointment Reminder!* 🐾\n\nHi ${appt.pet.owner.name}, this is a friendly reminder that *${appt.pet.pet_name}* has a grooming session tomorrow (${appt.appointment_date}) at ${appt.appointment_time}. We look forward to seeing you! ✨`;
                    await sendMessage(appt.pet.owner.whatsapp_number, msg, process.env.INSTANCE_NAME || 'petflow');
                }
            }
        } catch (error) {
            console.error('Error in Tomorrow\'s Reminders:', error);
        }
    });

    // 2. Re-booking Engine (Every day at 11:00 AM)
    // Check for clients whose last visit was 6 weeks ago
    cron.schedule('0 11 * * *', async () => {
        console.log('⏰ Running: Re-booking Engine');
        try {
            const sixWeeksAgo = new Date();
            sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // 42 days = 6 weeks
            const dateStr = sixWeeksAgo.toISOString().split('T')[0];

            // Find appointments that were 'Done' exactly 6 weeks ago
            const oldAppts = await prisma.appointment.findMany({
                where: {
                    appointment_date: dateStr,
                    status: { in: ['Done', 'CheckOut'] }
                },
                include: {
                    pet: {
                        include: {
                            owner: true,
                            appointments: {
                                where: {
                                    appointment_date: { gt: dateStr }
                                }
                            }
                        }
                    }
                }
            });

            for (const appt of oldAppts) {
                // Only message if they don't have any future appointments booked
                if (appt.pet.appointments.length === 0 && appt.pet?.owner?.whatsapp_number) {
                    const msg = `*Time for a refresh?* 🛁✨\n\nHi ${appt.pet.owner.name}, it's been about 6 weeks since *${appt.pet.pet_name}* last visited us. Would you like to book another grooming session to keep them looking and feeling their best? 🐾\n\nJust reply to this message and I can help you find a slot!`;
                    await sendMessage(appt.pet.owner.whatsapp_number, msg, process.env.INSTANCE_NAME || 'petflow');
                }
            }
        } catch (error) {
            console.error('Error in Re-booking Engine:', error);
        }
    });

    // 3. Daily Feedback (Every day at 6:00 PM)
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running: Daily Feedback Requests');
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            const todayAppts = await prisma.appointment.findMany({
                where: {
                    appointment_date: todayStr,
                    status: 'CheckOut' 
                },
                include: {
                    pet: {
                        include: { owner: true }
                    }
                }
            });

            for (const appt of todayAppts) {
                if (appt.pet?.owner?.whatsapp_number) {
                    const msg = `*How was your experience?* ⭐\n\nHi ${appt.pet.owner.name}, thank you for bringing *${appt.pet.pet_name}* to us today! We hope you both had a wonderful experience.\n\nIf you have a moment, we'd love to hear your feedback or see a photo of the fresh look! 🐾✨`;
                    await sendMessage(appt.pet.owner.whatsapp_number, msg, process.env.INSTANCE_NAME || 'petflow');
                }
            }
        } catch (error) {
            console.error('Error in Daily Feedback:', error);
        }
    });
}

/**
 * Manual trigger for testing automation logic immediately.
 * Use with caution in production.
 */
async function runAutomationTask(taskName) {
    console.log(`🚀 Manually triggering: ${taskName}`);
    // Logic can be extracted into separate functions if needed for DRY
}

module.exports = { initAutomation };
