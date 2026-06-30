const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendMessage } = require('./evolution');

const prisma = new PrismaClient();

async function initAutomation() {
    console.log('📅 Automation Service Initialized');

    // 1. Tomorrow's Reminders (Every day at 10:00 AM)
    cron.schedule('0 10 * * *', async () => {
        await runTomorrowsReminders();
    });

    // 2. Boarding Check-In Reminders (Every day at 10:30 AM)
    cron.schedule('0 10 * * *', async () => {
        await runBoardingReminders();
    });

    // 3. Re-booking Engine (Every day at 11:00 AM)
    cron.schedule('0 11 * * *', async () => {
        await runRebookingEngine();
    });

    // 4. Vaccination Due Soon Reminders (Every day at 12:00 PM)
    cron.schedule('0 12 * * *', async () => {
        await runVaccineReminders();
    });

    // 5. 2-Hour Appointment Reminders (Every hour at the top of the hour)
    cron.schedule('0 * * * *', async () => {
        await runTwoHourReminders();
    });

    // 6. Daily Feedback (Every day at 6:00 PM)
    cron.schedule('0 18 * * *', async () => {
        await runDailyFeedback();
    });
}

// ─── Individual Task Functions ──────────────────────────────────────────────

async function runTomorrowsReminders() {
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
}

async function runBoardingReminders() {
    console.log('⏰ Running: Boarding Check-In Reminders');
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const reservations = await prisma.boardingReservation.findMany({
            where: {
                check_in_date: tomorrowStr,
                status: 'Reserved'
            },
            include: {
                pet: {
                    include: { owner: true }
                },
                room: true
            }
        });

        for (const res of reservations) {
            if (res.pet?.owner?.whatsapp_number) {
                const ownerName = res.pet.owner.name;
                const petName = res.pet.pet_name;
                const roomName = res.room.name;
                const checkInDate = res.check_in_date;

                const message = `*Boarding Check-In Reminder!* 🏨🐾\n\nHi ${ownerName}, this is a friendly reminder that *${petName}* is scheduled for check-in tomorrow (${checkInDate}) for their boarding stay in room *${roomName}*.\n\n🎒 *Quick Checklist:*\n- Please bring their favorite food (divided by portion if possible).\n- Bring any daily medications with clear dosage instructions.\n- Don't forget their updated vaccination record.\n\nWe look forward to hosting them! ✨`;
                await sendMessage(res.pet.owner.whatsapp_number, message, process.env.INSTANCE_NAME || 'petflow');
            }
        }
    } catch (error) {
        console.error('Error in Boarding Check-In Reminders:', error);
    }
}

async function runRebookingEngine() {
    console.log('⏰ Running: Re-booking Engine');
    try {
        const sixWeeksAgo = new Date();
        sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // 42 days = 6 weeks
        const dateStr = sixWeeksAgo.toISOString().split('T')[0];

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
            if (appt.pet.appointments.length === 0 && appt.pet?.owner?.whatsapp_number) {
                const msg = `*Time for a refresh?* 🛁✨\n\nHi ${appt.pet.owner.name}, it's been about 6 weeks since *${appt.pet.pet_name}* last visited us. Would you like to book another grooming session to keep them looking and feeling their best? 🐾\n\nJust reply to this message and I can help you find a slot!`;
                await sendMessage(appt.pet.owner.whatsapp_number, msg, process.env.INSTANCE_NAME || 'petflow');
            }
        }
    } catch (error) {
        console.error('Error in Re-booking Engine:', error);
    }
}

async function runVaccineReminders() {
    console.log('⏰ Running: Vaccine Due Soon Reminders');
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

        for (const record of upcomingBoosterRecords) {
            if (record.pet?.owner?.whatsapp_number) {
                const ownerName = record.pet.owner.name;
                const petName = record.pet.pet_name;
                const vaccineName = record.vaccine_name;
                const dueDateFormatted = record.due_date.toISOString().split('T')[0];

                const message = `*Vaccination Due Soon!* 💉🐾\n\nHi ${ownerName}, this is a friendly reminder from PetFlow Spa that *${petName}*'s *${vaccineName}* booster is due soon on *${dueDateFormatted}*.\n\nKeep them safe and healthy! You can schedule their next visit here: [Booking Link]`;
                await sendMessage(record.pet.owner.whatsapp_number, message, process.env.INSTANCE_NAME || 'petflow');
            }
        }
    } catch (error) {
        console.error('Error in Vaccine Reminders:', error);
    }
}

async function runTwoHourReminders() {
    console.log('⏰ Running: 2-Hour Appointment Reminders');
    try {
        const now = new Date();
        const targetTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const hour = targetTime.getHours().toString().padStart(2, '0');
        const todayStr = now.toISOString().split('T')[0];

        const appointments = await prisma.appointment.findMany({
            where: {
                appointment_date: todayStr,
                appointment_time: {
                    startsWith: `${hour}:`
                },
                status: 'Booked'
            },
            include: {
                pet: {
                    include: { owner: true }
                }
            }
        });

        for (const appt of appointments) {
            if (appt.pet?.owner?.whatsapp_number) {
                const msg = `*Appointment Reminder!* 🐾\n\nHi ${appt.pet.owner.name}, this is a friendly reminder that *${appt.pet.pet_name}* has an appointment in about 2 hours (${appt.appointment_time}). See you soon!`;
                await sendMessage(appt.pet.owner.whatsapp_number, msg, process.env.INSTANCE_NAME || 'petflow');
            }
        }
    } catch (error) {
        console.error('Error in 2-Hour Reminders:', error);
    }
}

async function runDailyFeedback() {
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
}

/**
 * Manual trigger for testing automation logic immediately.
 */
async function runAutomationTask(taskName) {
    console.log(`🚀 Manually triggering: ${taskName}`);
    if (taskName === 'tomorrow_reminders') {
        await runTomorrowsReminders();
    } else if (taskName === 'boarding_reminders') {
        await runBoardingReminders();
    } else if (taskName === 'rebooking') {
        await runRebookingEngine();
    } else if (taskName === 'vaccines') {
        await runVaccineReminders();
    } else if (taskName === 'two_hour_reminders') {
        await runTwoHourReminders();
    } else if (taskName === 'feedback') {
        await runDailyFeedback();
    } else {
        console.log(`⚠️ Unknown task name: ${taskName}`);
    }
}

module.exports = { initAutomation, runAutomationTask };
