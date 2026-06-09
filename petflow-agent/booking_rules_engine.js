'use strict';

/**
 * Booking Rules Engine
 * Validates appointment requests against tenant-specific booking configuration.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Parse HH:MM string to total minutes from midnight.
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Format total minutes to HH:MM string.
 */
function minutesToTime(totalMins) {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get day key (mon, tue, ...) from a YYYY-MM-DD date string.
 */
function getDayKey(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return DAY_KEYS[new Date(y, m - 1, d).getDay()];
}

/**
 * Main validation function.
 * @param {object} params
 * @param {string} params.date - YYYY-MM-DD
 * @param {string} params.time - HH:MM
 * @param {number} params.duration - minutes (slot duration from config)
 * @param {object} rules - booking rules from PetroConfig
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBookingSlot({ date, time, duration }, rules) {
    if (!date || !time) {
        return { valid: false, error: 'Date and time are required.' };
    }

    const dayKey = getDayKey(date);
    const requestedStart = timeToMinutes(time);
    const requestedEnd = requestedStart + (duration || rules.slot_duration || 60);

    // ── Rule 1: Working Day Check ──
    const dayConfig = (rules.working_hours || {})[dayKey];
    if (!dayConfig || dayConfig.is_working === false) {
        const dayName = DAY_KEYS.indexOf(dayKey);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return {
            valid: false,
            error: `Sorry, we are closed on ${days[dayName]}s. Please choose another day.`
        };
    }

    // ── Rule 2: Working Hours Check ──
    if (dayConfig.start && dayConfig.end) {
        const shiftStart = timeToMinutes(dayConfig.start);
        const shiftEnd = timeToMinutes(dayConfig.end);
        if (requestedStart < shiftStart || requestedEnd > shiftEnd) {
            return {
                valid: false,
                error: `Our working hours are ${dayConfig.start} to ${dayConfig.end}. The requested time ${time} falls outside this window.`
            };
        }
    }

    // ── Rule 3: Advance Booking Limit ──
    if (rules.max_advance_days) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = date.split('-').map(Number);
        const requestedDate = new Date(y, m - 1, d);
        const diffDays = Math.round((requestedDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return { valid: false, error: 'You cannot book appointments in the past.' };
        }
        if (diffDays > rules.max_advance_days) {
            return {
                valid: false,
                error: `We only accept bookings up to ${rules.max_advance_days} days in advance. Please choose a date within this window.`
            };
        }
    }

    return { valid: true };
}

/**
 * Check if required fields have been collected before booking.
 * @param {object} collectedFields - fields collected so far { pet_name, breed, species, issue, etc. }
 * @param {string[]} requiredFields - field names required per config
 * @returns {{ ready: boolean, missing: string[] }}
 */
function checkRequiredFields(collectedFields, requiredFields) {
    if (!requiredFields || requiredFields.length === 0) {
        return { ready: true, missing: [] };
    }
    const missing = requiredFields.filter(field => {
        const val = collectedFields[field];
        return !val || (typeof val === 'string' && val.trim().length === 0);
    });
    return {
        ready: missing.length === 0,
        missing,
    };
}

module.exports = {
    validateBookingSlot,
    checkRequiredFields,
    timeToMinutes,
    minutesToTime,
    getDayKey,
};
