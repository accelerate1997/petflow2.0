require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const prisma = new PrismaClient();

const { buildSystemPrompt, loadConfig, getEnabledToolNames, getBookingRules } = require('./petro_config_loader');
const { validateBookingSlot } = require('./booking_rules_engine');
const { decrypt } = require('./encryption');

// System prompt is now built dynamically from PetroConfig DB via petro_config_loader.js
// buildSystemPrompt() is imported from petro_config_loader

/**
 * Tools (Functions) for the AI to call
 */
const tools = [
    {
        type: "function",
        function: {
            name: "search_client_and_pets",
            description: "Search for a client and their pets by phone number. Use this to see if the user is already registered.",
            parameters: {
                type: "object",
                properties: {
                    phone: {
                        type: "string",
                        description: "The phone number of the client (e.g. 919876543210)",
                    },
                },
                required: ["phone"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_client_profile",
            description: "Create a new client profile in the CRM.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "The full name of the client." },
                    phone: { type: "string", description: "The WhatsApp phone number of the client." },
                    email: { type: "string", description: "Optional email address." },
                },
                required: ["name", "phone"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "add_pet_to_profile",
            description: "Add a new pet to an existing client's profile.",
            parameters: {
                type: "object",
                properties: {
                    phone: { type: "string", description: "The owner's phone number." },
                    pet_name: { type: "string", description: "The name of the pet." },
                    species: { type: "string", enum: ["dog", "cat", "other"], description: "The species of the pet." },
                    breed: { type: "string", description: "The breed of the pet (optional)." },
                },
                required: ["phone", "pet_name", "species"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "create_appointment",
            description: "Book a new grooming appointment for a pet.",
            parameters: {
                type: "object",
                properties: {
                    pet_id: { type: "string", description: "The unique ID of the pet." },
                    service_type: { type: "string", description: "The name of the service (e.g. Full Grooming)." },
                    appointment_date: { type: "string", description: "The date (YYYY-MM-DD)." },
                    appointment_time: { type: "string", description: "The time (HH:MM)." },
                    notes: { type: "string", description: "Any special instructions (optional)." },
                },
                required: ["pet_id", "service_type", "appointment_date", "appointment_time"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_upcoming_appointments",
            description: "Fetch upcoming grooming appointments for a client by their phone number.",
            parameters: {
                type: "object",
                properties: {
                    phone: {
                        type: "string",
                        description: "The client's phone number.",
                    },
                },
                required: ["phone"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "reschedule_appointment",
            description: "Move an existing appointment to a new date and time.",
            parameters: {
                type: "object",
                properties: {
                    appointment_id: { type: "string", description: "The unique ID of the appointment." },
                    new_date: { type: "string", description: "The new date (YYYY-MM-DD)." },
                    new_time: { type: "string", description: "The new time (HH:MM)." },
                },
                required: ["appointment_id", "new_date", "new_time"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_available_services",
            description: "Get the list of grooming services and prices offered by the spa.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_vaccination_records",
            description: "Retrieve vaccination status and booster due dates for a specific pet.",
            parameters: {
                type: "object",
                properties: {
                    pet_id: { type: "string", description: "The unique ID of the pet." },
                },
                required: ["pet_id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "check_boarding_availability",
            description: "Check if there is room availability for pet boarding during a specific date range.",
            parameters: {
                type: "object",
                properties: {
                    pet_id: { type: "string", description: "The unique ID or name of the pet to board." },
                    check_in_date: { type: "string", description: "The check-in date (YYYY-MM-DD)." },
                    check_out_date: { type: "string", description: "The check-out date (YYYY-MM-DD)." }
                },
                required: ["pet_id", "check_in_date", "check_out_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_boarding_reservation",
            description: "Book a boarding reservation for a pet at a specific room.",
            parameters: {
                type: "object",
                properties: {
                    pet_id: { type: "string", description: "The unique ID or name of the pet." },
                    room_id: { type: "string", description: "The unique ID of the room to book." },
                    check_in_date: { type: "string", description: "The check-in date (YYYY-MM-DD)." },
                    check_out_date: { type: "string", description: "The check-out date (YYYY-MM-DD)." },
                    special_notes: { type: "string", description: "Optional feeding/medication or handling notes." }
                },
                required: ["pet_id", "room_id", "check_in_date", "check_out_date"]
            }
        }
    }
];

async function validateGroomerAvailability(appointmentId, date, time, serviceType, groomerId, tenantId = 'default-tenant-id') {
    // 1. Calculate duration for the service type
    const serviceNames = serviceType.split('+').map(s => s.trim());
    const matchingServices = await prisma.service.findMany({
        where: { service_name: { in: serviceNames }, tenantId }
    });
    const duration = matchingServices.reduce((sum, s) => sum + s.estimated_duration, 0) || 60;

    const [hours, minutes] = time.split(':').map(Number);
    const requestedStart = hours * 60 + minutes;
    const requestedEnd = requestedStart + duration;

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const [year, month, day] = date.split('-').map(Number);
    const dayName = daysOfWeek[new Date(year, month - 1, day).getDay()];

    // Helper to check if groomer is working during the requested time
    const isGroomerAvailableForShift = (groomer) => {
        const workingHours = groomer.working_hours || {};
        if (Object.keys(workingHours).length === 0) {
            return { available: true };
        }
        const dayShift = workingHours[dayName];
        if (!dayShift) {
            return { available: false, error: `${groomer.name} is not scheduled to work on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.` };
        }
        if (!dayShift.is_working) {
            return { available: false, error: `${groomer.name} is not working on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.` };
        }
        if (dayShift.start && dayShift.end) {
            const [startH, startM] = dayShift.start.split(':').map(Number);
            const [endH, endM] = dayShift.end.split(':').map(Number);
            const shiftStart = startH * 60 + startM;
            const shiftEnd = endH * 60 + endM;
            if (requestedStart < shiftStart || requestedEnd > shiftEnd) {
                return {
                    available: false,
                    error: `Requested time ${time} - ${minutesToTimeStr(requestedEnd)} is outside ${groomer.name}'s working hours (${dayShift.start} - ${dayShift.end}).`
                };
            }
        }
        return { available: true };
    };

    // Helper to check if a specific groomer has overlapping appointments
    const hasConflict = async (gId) => {
        const existingAppointments = await prisma.appointment.findMany({
            where: {
                appointment_date: date,
                groomer_id: gId,
                id: appointmentId ? { not: appointmentId } : undefined,
                status: { notIn: ['Cancelled', 'No-show', 'Done'] },
                tenantId
            }
        });

        for (const app of existingAppointments) {
            // Find duration of existing appointment
            const exServiceNames = app.service_type.split('+').map(s => s.trim());
            const exMatchingServices = await prisma.service.findMany({
                where: { service_name: { in: exServiceNames }, tenantId }
            });
            const exDuration = exMatchingServices.reduce((sum, s) => sum + s.estimated_duration, 0) || 60;

            const [exHours, exMinutes] = app.appointment_time.split(':').map(Number);
            const exStart = exHours * 60 + exMinutes;
            const exEnd = exStart + exDuration;

            // Overlap condition
            if (exStart < requestedEnd && exEnd > requestedStart) {
                return true;
            }
        }
        return false;
    };

    if (groomerId) {
        // Check specific groomer
        const groomer = await prisma.staff.findFirst({ where: { id: groomerId, tenantId } });
        if (!groomer) {
            return { success: false, groomerId: null, error: 'Groomer not found.' };
        }
        const shiftCheck = isGroomerAvailableForShift(groomer);
        if (!shiftCheck.available) {
            return { success: false, groomerId: null, error: shiftCheck.error };
        }
        const conflict = await hasConflict(groomerId);
        if (conflict) {
            return {
                success: false,
                groomerId: null,
                error: `Groomer ${groomer.name} is already booked between ${time} and ${minutesToTimeStr(requestedEnd)}.`
            };
        }
        return { success: true, groomerId };
    } else {
        // Auto-assign: Find all active groomers
        const activeGroomers = await prisma.staff.findMany({
            where: {
                status: 'Active',
                role: { in: ['Groomer', 'Senior Groomer'] },
                tenantId
            }
        });

        if (activeGroomers.length === 0) {
            // No active groomers, proceed without assignment
            return { success: true, groomerId: null };
        }

        for (const groomer of activeGroomers) {
            const shiftCheck = isGroomerAvailableForShift(groomer);
            if (!shiftCheck.available) continue;

            const conflict = await hasConflict(groomer.id);
            if (!conflict) {
                // Found a free groomer!
                return { success: true, groomerId: groomer.id };
            }
        }

        return {
            success: false,
            groomerId: null,
            error: `All active groomers are fully booked or off-duty between ${time} and ${minutesToTimeStr(requestedEnd)}.`
        };
    }
}

function minutesToTimeStr(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Implementation of the tool functions
 */
function getTenantIdFromParam(tenantIdOrConfig) {
    if (tenantIdOrConfig && typeof tenantIdOrConfig === 'object') {
        return tenantIdOrConfig.tenantId || 'default-tenant-id';
    }
    return tenantIdOrConfig || 'default-tenant-id';
}

const toolImplementations = {
    search_client_and_pets: async ({ phone }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const cleanPhone = phone.slice(-10);
            const client = await prisma.client.findFirst({
                where: { whatsapp_number: { contains: cleanPhone }, tenantId },
                include: { pets: true }
            });
            if (!client) return { found: false, message: "No client found with this number." };
            return {
                found: true,
                client_id: client.id,
                client_name: client.name,
                pets: client.pets.map(p => ({
                    id: p.id,
                    name: p.pet_name,
                    species: p.species,
                    breed: p.breed,
                    medical_alerts: p.medical_alerts,
                    temperament_notes: p.temperament_notes
                }))
            };
        } catch (error) {
            return { error: "Failed to search database." };
        }
    },
    create_client_profile: async ({ name, phone, email }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const client = await prisma.client.create({
                data: {
                    name,
                    whatsapp_number: phone,
                    email: email || null,
                    tenantId
                }
            });
            return { success: true, message: `Profile created for ${name}`, client_id: client.id };
        } catch (error) {
            console.error('[Create Profile Error]:', error);
            return { success: false, error: "Could not create profile. It may already exist." };
        }
    },
    add_pet_to_profile: async ({ phone, pet_name, species, breed }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const cleanPhone = phone.slice(-10);
            const client = await prisma.client.findFirst({
                where: { whatsapp_number: { contains: cleanPhone }, tenantId }
            });
            if (!client) return { success: false, message: "Client not found. Create a profile first." };

            const pet = await prisma.pet.create({
                data: {
                    pet_name,
                    species,
                    breed: breed || null,
                    owner_id: client.id,
                    tenantId
                }
            });
            return { success: true, message: `${pet_name} added to ${client.name}'s profile.`, pet_id: pet.id };
        } catch (error) {
            console.error('[Add Pet Error]:', error);
            return { success: false, error: "Failed to add pet." };
        }
    },
    create_appointment: async ({ pet_id, service_type, appointment_date, appointment_time, notes }, draftConfig = null, executionLogs = null, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(draftConfig || tenantIdOrConfig);
            
            // Resolve pet_id (could be name or ID) within tenant
            let pet = await prisma.pet.findFirst({
                where: { id: pet_id, tenantId }
            }).catch(() => null);

            if (!pet) {
                // Try searching by name case-insensitively within tenant
                pet = await prisma.pet.findFirst({
                    where: { pet_name: { equals: pet_id, mode: 'insensitive' }, tenantId }
                });
            }

            if (executionLogs) {
                executionLogs.push(`[Pet Resolution] Resolved pet_id "${pet_id}" to: ${pet ? 'Pet "' + pet.pet_name + '" (ID: ' + pet.id + ')' : 'NOT FOUND'}`);
            }

            if (!pet) {
                return {
                    success: false,
                    error: `Pet "${pet_id}" was not found in our database. Please make sure the client profile is created and the pet is added, or check the spelling.`
                };
            }

            const resolvedTenantId = pet.tenantId || tenantId;

            // Booking Rules Engine — validate against PetroConfig rules
            const petroConfig = draftConfig || await loadConfig(resolvedTenantId);
            const rules = getBookingRules(petroConfig);
            const slotDuration = rules.slot_duration || 60;
            const rulesCheck = validateBookingSlot(
                { date: appointment_date, time: appointment_time, duration: slotDuration },
                rules
            );

            if (executionLogs) {
                executionLogs.push(`[Booking Rules Engine] Validating slot: ${appointment_date} at ${appointment_time} (Duration: ${slotDuration} mins). Result: ${rulesCheck.valid ? 'VALID' : 'INVALID: ' + rulesCheck.error}`);
            }

            if (!rulesCheck.valid) {
                return { success: false, error: rulesCheck.error };
            }

            // Groomer availability check
            const check = await validateGroomerAvailability(null, appointment_date, appointment_time, service_type, null, resolvedTenantId);

            if (executionLogs) {
                executionLogs.push(`[Groomer Availability] Checking staff for ${service_type}. Result: ${check.success ? 'AVAILABLE (Groomer ID: ' + check.groomerId + ')' : 'UNAVAILABLE: ' + check.error}`);
            }

            if (!check.success) {
                return { success: false, error: check.error };
            }

            const appt = await prisma.appointment.create({
                data: {
                    pet_id: pet.id,
                    service_type,
                    appointment_date,
                    appointment_time,
                    notes: notes || null,
                    status: 'Booked',
                    groomer_id: check.groomerId,
                    tenantId: resolvedTenantId
                }
            });

            // Check for overdue vaccines
            const overdue = await prisma.vaccinationRecord.findMany({
                where: {
                    pet_id: pet.id,
                    status: 'Overdue'
                }
            });
            const warning = overdue.length > 0 
                ? `WARNING: The pet has overdue vaccinations: ${overdue.map(o => o.vaccine_name).join(', ')}. Please advise the owner to bring updated records or schedule boosters.`
                : null;

            return { 
                success: true, 
                message: `Appointment booked for ${appointment_date} at ${appointment_time}.`, 
                appointment_id: appt.id,
                vaccine_warning: warning
            };
        } catch (error) {
            console.error('[Create Appointment Error]:', error);
            return { success: false, error: "Failed to book appointment." };
        }
    },
    get_upcoming_appointments: async ({ phone }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const cleanPhone = phone.slice(-10);
            const client = await prisma.client.findFirst({
                where: { whatsapp_number: { contains: cleanPhone }, tenantId },
                include: { 
                    pets: {
                        include: {
                            appointments: {
                                where: { status: { in: ['Booked', 'Confirmed'] }, tenantId },
                                orderBy: { appointment_date: 'asc' },
                                take: 5
                            }
                        }
                    }
                }
            });
            if (!client) return { message: "Client not found." };
            
            const appointments = client.pets.flatMap(p => 
                p.appointments.map(a => ({
                    appointment_id: a.id,
                    pet_name: p.pet_name,
                    date: a.appointment_date,
                    time: a.appointment_time,
                    service: a.service_type,
                    status: a.status
                }))
            );

            return appointments.length > 0 ? { appointments } : { message: "No upcoming appointments." };
        } catch (error) {
            return { error: "Failed to fetch appointments." };
        }
    },
    reschedule_appointment: async ({ appointment_id, new_date, new_time }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const existing = await prisma.appointment.findFirst({
                where: { id: appointment_id, tenantId }
            });
            if (!existing) {
                return { success: false, error: "Appointment not found." };
            }

            const check = await validateGroomerAvailability(
                appointment_id,
                new_date,
                new_time,
                existing.service_type,
                existing.groomer_id,
                tenantId
            );
            if (!check.success) {
                return { success: false, error: check.error };
            }

            const updated = await prisma.appointment.update({
                where: { id: appointment_id },
                data: {
                    appointment_date: new_date,
                    appointment_time: new_time,
                    groomer_id: check.groomerId
                }
            });
            return { success: true, message: `Appointment rescheduled to ${new_date} at ${new_time}.` };
        } catch (error) {
            console.error('[Reschedule Error]:', error);
            return { success: false, error: "Failed to reschedule. Check the appointment ID." };
        }
    },
    list_available_services: async ({}, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            const services = await prisma.service.findMany({
                where: { tenantId }
            });
            return services.map(s => ({
                name: s.service_name,
                price: s.price,
                description: s.description
            }));
        } catch (error) {
            return { error: "Failed to fetch services." };
        }
    },
    get_vaccination_records: async ({ pet_id }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            let pet = await prisma.pet.findFirst({
                where: { id: pet_id, tenantId },
                include: { vaccinations: true }
            }).catch(() => null);

            if (!pet) {
                pet = await prisma.pet.findFirst({
                    where: { pet_name: { equals: pet_id, mode: 'insensitive' }, tenantId },
                    include: { vaccinations: true }
                });
            }

            if (!pet) return { success: false, error: "Pet not found." };
            if (!pet.vaccinations || pet.vaccinations.length === 0) {
                return { success: true, message: `No vaccination records found for ${pet.pet_name}.` };
            }
            return {
                success: true,
                pet_name: pet.pet_name,
                vaccinations: pet.vaccinations.map(v => ({
                    vaccine_name: v.vaccine_name,
                    administered: v.administered.toISOString().split('T')[0],
                    due_date: v.due_date.toISOString().split('T')[0],
                    status: v.status,
                    notes: v.notes
                }))
            };
        } catch (error) {
            console.error('[Get Vaccinations Error]:', error);
            return { success: false, error: "Failed to fetch vaccination records." };
        }
    },
    check_boarding_availability: async ({ pet_id, check_in_date, check_out_date }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            let pet = await prisma.pet.findFirst({
                where: { id: pet_id, tenantId }
            }).catch(() => null);

            if (!pet) {
                pet = await prisma.pet.findFirst({
                    where: { pet_name: { equals: pet_id, mode: 'insensitive' }, tenantId }
                });
            }

            if (!pet) {
                return { success: false, error: `Pet "${pet_id}" not found.` };
            }

            const weight = pet.weight || 0;
            const species = (pet.species || '').toLowerCase();
            let sizeCategory = 'Medium';
            if (species === 'cat') {
                sizeCategory = 'Cat';
            } else {
                if (weight > 0 && weight < 10) sizeCategory = 'Small';
                else if (weight >= 10 && weight <= 25) sizeCategory = 'Medium';
                else if (weight > 25) sizeCategory = 'Large';
            }

            const rooms = await prisma.boardingRoom.findMany({
                where: {
                    status: 'Available',
                    tenantId,
                    OR: [
                        { pet_type: 'all' },
                        { pet_type: species }
                    ]
                },
                include: {
                    reservations: {
                        where: {
                            status: { in: ['Reserved', 'CheckedIn'] },
                            tenantId
                        }
                    }
                }
            });

            const availableRooms = [];
            for (const room of rooms) {
                const isOverlapping = room.reservations.some(res => {
                    return check_in_date < res.check_out_date && check_out_date > res.check_in_date;
                });

                if (!isOverlapping) {
                    availableRooms.push({
                        id: room.id,
                        name: room.name,
                        room_type: room.room_type,
                        size_category: room.size_category,
                        price_per_night: room.price_per_night,
                        capacity: room.capacity
                    });
                }
            }

            return {
                success: true,
                pet_name: pet.pet_name,
                pet_size_category: sizeCategory,
                available_rooms: availableRooms
            };
        } catch (error) {
            console.error('[Check Boarding Availability Error]:', error);
            return { success: false, error: "Failed to check boarding availability." };
        }
    },
    create_boarding_reservation: async ({ pet_id, room_id, check_in_date, check_out_date, special_notes }, tenantIdOrConfig = null) => {
        try {
            const tenantId = getTenantIdFromParam(tenantIdOrConfig);
            let pet = await prisma.pet.findFirst({
                where: { id: pet_id, tenantId }
            }).catch(() => null);

            if (!pet) {
                pet = await prisma.pet.findFirst({
                    where: { pet_name: { equals: pet_id, mode: 'insensitive' }, tenantId }
                });
            }

            if (!pet) return { success: false, error: `Pet "${pet_id}" not found.` };

            const room = await prisma.boardingRoom.findFirst({
                where: { id: room_id, tenantId }
            });
            if (!room) return { success: false, error: "Room not found." };
            if (room.status === 'Maintenance') return { success: false, error: "Room is currently under maintenance." };

            const overlaps = await prisma.boardingReservation.findFirst({
                where: {
                    room_id,
                    status: { in: ['Reserved', 'CheckedIn'] },
                    check_in_date: { lt: check_out_date },
                    check_out_date: { gt: check_in_date },
                    tenantId
                }
            });
            if (overlaps) {
                return { success: false, error: "Room is already occupied or reserved during these dates." };
            }

            const start = new Date(check_in_date + 'T00:00:00');
            const end = new Date(check_out_date + 'T00:00:00');
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            const totalAmount = room.price_per_night * totalNights;

            const reservation = await prisma.boardingReservation.create({
                data: {
                    room_id,
                    pet_id: pet.id,
                    check_in_date,
                    check_out_date,
                    total_nights: totalNights,
                    total_amount: totalAmount,
                    status: 'Reserved',
                    payment_status: 'Pending',
                    special_notes: special_notes || null,
                    tenantId: pet.tenantId || tenantId
                }
            });

            return {
                success: true,
                message: `Boarding reservation created successfully for ${pet.pet_name} in ${room.name}!`,
                reservation_id: reservation.id,
                total_nights: totalNights,
                total_amount: totalAmount
            };
        } catch (error) {
            console.error('[Create Boarding Reservation Error]:', error);
            return { success: false, error: "Failed to create boarding reservation." };
        }
    }
};

/**
 * Persist a message to the database.
 */
async function saveMessage(sessionId, role, content, tool_call_id = null, name = null) {
    try {
        const msg = await prisma.chatMessage.create({
            data: {
                session_id: sessionId,
                role,
                content: typeof content === 'string' ? content : JSON.stringify(content),
                tool_call_id,
                name,
            }
        });
        // Update session's last_message and updated timestamp
        if (role === 'user' || role === 'assistant') {
            const preview = typeof content === 'string' ? content : 'Calling tools...';
            await prisma.chatSession.update({
                where: { id: sessionId },
                data: { 
                    last_message: role === 'user' ? preview : preview.slice(0, 100),
                    updated: new Date()
                }
            });
        }
        return msg;
    } catch (error) {
        console.error('[DB Save Error]:', error);
        return null;
    }
}

/**
 * Find or create a session for a phone number.
 */
async function getOrCreateSession(phone) {
    let session = await prisma.chatSession.findUnique({
        where: { phone },
        include: { messages: { orderBy: { created: 'asc' }, take: 50 } }
    });

    const instanceName = process.env.INSTANCE_NAME || 'PetFlow_Spa';
    const waConfig = await prisma.whatsAppConfig.findFirst({
        where: { instance_name: instanceName }
    });
    const activeTenantId = waConfig?.tenantId || 'default-tenant-id';

    if (!session) {
        // Find client if exists
        const client = await prisma.client.findFirst({
            where: { whatsapp_number: { contains: phone.slice(-10) }, tenantId: activeTenantId }
        });

        session = await prisma.chatSession.create({
            data: {
                phone,
                client_id: client?.id,
                tenantId: activeTenantId,
                last_message: 'New Session'
            },
            include: { messages: true }
        });
    } else if (!session.tenantId) {
        // Populate tenant ID if it was null
        session = await prisma.chatSession.update({
            where: { id: session.id },
            data: { tenantId: activeTenantId },
            include: { messages: true }
        });
    }

    return session;
}

/**
 * Process an incoming WhatsApp message through Petro (AI).
 */
async function processMessage(userInput, phone, onMessageSaved = null) {
    try {
        const session = await getOrCreateSession(phone);
        
        if (session.is_paused) {
            const savedMsg = await saveMessage(session.id, 'user', userInput);
            if (onMessageSaved && savedMsg) onMessageSaved(savedMsg);
            return null;
        }

        // Load WhatsApp config from DB to get the OpenAI API key
        const whatsAppConfig = await prisma.whatsAppConfig.findFirst(
            session.tenantId ? { where: { tenantId: session.tenantId } } : undefined
        );
        const openAiKey = decrypt(whatsAppConfig?.openai_api_key) || process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            throw new Error("OpenAI API Key is missing. Please configure it in CRM Settings under the WhatsApp tab.");
        }
        const clientOpenai = new OpenAI({ apiKey: openAiKey });

        let systemPrompt = await buildSystemPrompt(session.tenantId);
        systemPrompt += `\n\nActive Client Phone: ${phone}\n(Use this phone number whenever calling tools that require a client's or owner's phone number.)`;

        const chatContext = [
            { role: 'system', content: systemPrompt }
        ];

        const history = [];
        const messages = session.messages.filter(m => m.role !== 'system');
        
        // Prune history older than 6 hours to prevent LLM memory pollution
        const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000; 
        const now = Date.now();
        const freshMessages = messages.filter(m => (now - m.created.getTime()) < SESSION_TIMEOUT_MS);

        for (let i = 0; i < freshMessages.length; i++) {
            const m = freshMessages[i];
            const msg = { role: m.role, content: m.content };
            
            if (m.role === 'tool') {
                msg.tool_call_id = m.tool_call_id;
                msg.name = m.name;
                
                const prev = history[history.length - 1];
                if (prev && prev.role === 'assistant' && !prev.tool_calls) {
                    prev.tool_calls = [{
                        id: m.tool_call_id,
                        type: 'function',
                        function: { name: m.name, arguments: "{}" }
                    }];
                }
            }
            
            history.push(msg);
        }

        chatContext.push(...history.slice(-25));
        chatContext.push({ role: 'user', content: userInput });

        // Save User Message
        const savedUserMsg = await saveMessage(session.id, 'user', userInput);
        if (onMessageSaved && savedUserMsg) onMessageSaved(savedUserMsg);

        // Load config and get only enabled tools
        const petroConfig = await loadConfig(session.tenantId);
        const enabledToolNames = getEnabledToolNames(petroConfig);
        const filteredTools = tools.filter(t => enabledToolNames.includes(t.function.name));

        let response = await clientOpenai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: chatContext,
            tools: filteredTools.length > 0 ? filteredTools : tools,
            tool_choice: "auto",
            temperature: 0.7,
        });

        let assistantMessage = response.choices[0].message;

        // Handle Tool Calls
        if (assistantMessage.tool_calls) {
            const savedAssistantToolCallMsg = await prisma.chatMessage.create({
                data: {
                    session_id: session.id,
                    role: 'assistant',
                    content: assistantMessage.content || '',
                }
            });
            if (onMessageSaved && savedAssistantToolCallMsg) onMessageSaved(savedAssistantToolCallMsg);

            chatContext.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`[TOOL] Petro is calling: ${functionName}`);
                
                let toolResponse;
                if (functionName === 'create_appointment') {
                    toolResponse = await toolImplementations.create_appointment(functionArgs, null, null, session.tenantId);
                } else {
                    toolResponse = await toolImplementations[functionName](functionArgs, session.tenantId);
                }
                
                // Save Tool Result
                const savedToolMsg = await saveMessage(session.id, 'tool', JSON.stringify(toolResponse), toolCall.id, functionName);
                if (onMessageSaved && savedToolMsg) onMessageSaved(savedToolMsg);

                chatContext.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse),
                });
            }

            // Get final response from AI after tool results
            response = await clientOpenai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: chatContext,
            });
            assistantMessage = response.choices[0].message;
        }

        const replyText = assistantMessage.content?.trim();
        
        // Save Assistant Reply
        if (replyText) {
            const savedAssistantMsg = await saveMessage(session.id, 'assistant', replyText);
            if (onMessageSaved && savedAssistantMsg) onMessageSaved(savedAssistantMsg);
        }

        return replyText || "🐾 Sorry, I'm having a bit of trouble. Could you try again?";

    } catch (error) {
        console.error('[Petro Error]:', error.message);
        return `🐾 Sorry, I ran into a little issue: ${error.message}. Please try again shortly!`;
    }
}

async function clearSession(phone) {
    const session = await prisma.chatSession.findUnique({ where: { phone } });
    if (session) {
        await prisma.chatMessage.deleteMany({ where: { session_id: session.id } });
        await prisma.chatSession.delete({ where: { id: session.id } });
    }
}

async function getActiveSessions() {
    const sessions = await prisma.chatSession.findMany({
        orderBy: { updated: 'desc' },
        take: 50
    });
    return sessions.map(s => s.phone);
}

async function getSessionInfo(phone) {
    const session = await prisma.chatSession.findUnique({
        where: { phone },
        include: { messages: { orderBy: { created: 'desc' }, take: 5 } }
    });
    if (!session) return null;
    return {
        phone,
        messageCount: session.messages.length,
        preview: session.messages
    };
}

/**
 * Process a sandbox/playground chat completion against a draft PetroConfig.
 */
async function processPlaygroundMessage({ draftConfig, messages }) {
    const executionLogs = [];
    try {
        const { compileSystemPrompt } = require('./petro_config_loader');
        
        // 1. Load WhatsApp and settings configs for placeholder replacement
        const tenantId = draftConfig?.tenantId || null;
        const [whatsAppConfig, settings] = await Promise.all([
            prisma.whatsAppConfig.findFirst(tenantId ? { where: { tenantId } } : undefined),
            prisma.settings.findFirst(tenantId ? { where: { tenantId } } : undefined),
        ]);

        const openAiKey = decrypt(whatsAppConfig?.openai_api_key) || process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            throw new Error("OpenAI API Key is missing. Please configure it in CRM Settings under the WhatsApp tab.");
        }
        const clientOpenai = new OpenAI({ apiKey: openAiKey });
        
        // 2. Compile draft system prompt
        const systemPrompt = compileSystemPrompt(draftConfig, whatsAppConfig, settings);
        executionLogs.push(`[System Prompt] Compiled draft persona for agent "${draftConfig.agent_name || 'Petro'}" (tone: "${draftConfig.tone || 'friendly'}").`);

        const chatContext = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        // 3. Filter tools enabled
        const enabledToolNames = getEnabledToolNames(draftConfig);
        const filteredTools = tools.filter(t => enabledToolNames.includes(t.function.name));
        executionLogs.push(`[Tools Gating] Enabled tools: [${enabledToolNames.join(', ')}].`);

        executionLogs.push(`[OpenAI] Sending chat completion request...`);
        let response = await clientOpenai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: chatContext,
            tools: filteredTools.length > 0 ? filteredTools : undefined,
            tool_choice: filteredTools.length > 0 ? "auto" : undefined,
            temperature: 0.7,
        });

        let assistantMessage = response.choices[0].message;

        // 4. Handle Tool Calls if generated by LLM
        if (assistantMessage.tool_calls) {
            executionLogs.push(`[OpenAI Tool Calls] LLM requested ${assistantMessage.tool_calls.length} tool call(s).`);
            chatContext.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                executionLogs.push(`[Tool Execution] Calling "${functionName}" with args: ${JSON.stringify(functionArgs)}`);
                
                let toolResponse;
                if (toolImplementations[functionName]) {
                    // Pass draftConfig and executionLogs to tool implementations
                    toolResponse = await toolImplementations[functionName](functionArgs, draftConfig, executionLogs);
                } else {
                    toolResponse = { error: `Tool "${functionName}" is not implemented.` };
                }
                
                executionLogs.push(`[Tool Response] "${functionName}" returned: ${JSON.stringify(toolResponse)}`);

                chatContext.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResponse),
                });
            }

            executionLogs.push(`[OpenAI] Sending second completion request with tool results...`);
            response = await clientOpenai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: chatContext,
            });
            assistantMessage = response.choices[0].message;
        }

        const replyText = assistantMessage.content?.trim() || "🐾 Sorry, I'm having a bit of trouble.";
        executionLogs.push(`[Response Generated] Petro: "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`);
        
        return {
            reply: replyText,
            logs: executionLogs
        };

    } catch (error) {
        console.error('[Playground Error]:', error);
        executionLogs.push(`[ERROR] Execution failed: ${error.message}`);
        return {
            reply: "🐾 Sorry, I ran into a little issue. Please try again shortly!",
            logs: executionLogs
        };
    }
}

module.exports = {
    processMessage,
    clearSession,
    getActiveSessions,
    getSessionInfo,
    processPlaygroundMessage
};
