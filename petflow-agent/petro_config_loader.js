require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FALLBACK_PROMPT = fs.readFileSync(
    path.join(__dirname, 'pet_spa_prompt.md'),
    'utf-8'
);

// All available tools in the system
const ALL_TOOLS = [
    'search_client_and_pets',
    'create_client_profile',
    'add_pet_to_profile',
    'create_appointment',
    'get_upcoming_appointments',
    'reschedule_appointment',
    'list_available_services',
    'get_vaccination_records',
    'check_boarding_availability',
    'create_boarding_reservation',
];

// Default tools if config has no tools_enabled set
const DEFAULT_TOOLS = [
    'search_client_and_pets',
    'create_client_profile',
    'add_pet_to_profile',
    'create_appointment',
    'get_upcoming_appointments',
    'reschedule_appointment',
    'list_available_services',
    'get_vaccination_records',
    'check_boarding_availability',
    'create_boarding_reservation',
];

// Default booking rules if not configured
const DEFAULT_BOOKING_RULES = {
    slot_duration: 60,
    max_advance_days: 30,
    max_concurrent: 3,
    working_hours: {
        mon: { start: '09:00', end: '18:00', is_working: true },
        tue: { start: '09:00', end: '18:00', is_working: true },
        wed: { start: '09:00', end: '18:00', is_working: true },
        thu: { start: '09:00', end: '18:00', is_working: true },
        fri: { start: '09:00', end: '18:00', is_working: true },
        sat: { start: '09:00', end: '14:00', is_working: true },
        sun: { start: '09:00', end: '14:00', is_working: false },
    },
    required_fields: ['pet_name', 'species'],
};

let configCache = {};
let cacheExpiry = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Load PetroConfig from DB with in-memory caching.
 */
async function loadConfig(tenantId) {
    if (!tenantId) return null;
    const now = Date.now();
    if (configCache[tenantId] && now < cacheExpiry[tenantId]) {
        return configCache[tenantId];
    }

    try {
        const config = await prisma.petroConfig.findFirst({
            where: { is_active: true, tenantId },
            orderBy: { created: 'desc' }
        });

        if (config) {
            configCache[tenantId] = config;
            cacheExpiry[tenantId] = now + CACHE_TTL_MS;
            return config;
        }
    } catch (error) {
        console.error(`[PetroConfig] Failed to load config for tenant ${tenantId}:`, error.message);
    }

    // Return null if no config in DB (will use defaults)
    return null;
}

/**
 * Invalidate the config cache (call after saving new config).
 */
function invalidateCache(tenantId) {
    if (tenantId) {
        delete configCache[tenantId];
        delete cacheExpiry[tenantId];
    } else {
        configCache = {};
        cacheExpiry = {};
    }
}

/**
 * Compile system prompt synchronously from active/draft config, WhatsApp config, and settings.
 */
function compileSystemPrompt(petroConfig, whatsAppConfig, settings) {
    const spaName = whatsAppConfig?.spa_name || settings?.spa_name || process.env.SPA_NAME || 'PetFlow Spa';
    const bookingLink = whatsAppConfig?.booking_link || process.env.BOOKING_LINK || '';
    const today = new Date().toDateString();

    // Use custom persona from PetroConfig if available, else fall back to WhatsAppConfig system_prompt, else use file
    let promptTemplate = FALLBACK_PROMPT;
    if (petroConfig?.persona && petroConfig.persona.trim().length > 0) {
        promptTemplate = petroConfig.persona;
    } else if (whatsAppConfig?.system_prompt && whatsAppConfig.system_prompt.trim().length > 0) {
        promptTemplate = whatsAppConfig.system_prompt;
    }

    let prompt = promptTemplate
        .replace(/\[BOOKING_LINK\]/g, bookingLink)
        .replace(/\[SPA_NAME\]/g, spaName);

    if (petroConfig) {
        const agentName = petroConfig.agent_name || 'Petro';
        prompt = prompt.replace(/\bPetro\b/g, agentName);

        // Append knowledge base entries if any
        const kb = Array.isArray(petroConfig.knowledge_base) ? petroConfig.knowledge_base : [];
        if (kb.length > 0) {
            prompt += '\n\n## BUSINESS KNOWLEDGE BASE\n';
            prompt += 'Use the following information to answer client questions accurately:\n\n';
            kb.forEach((entry, i) => {
                if (entry.question && entry.answer) {
                    prompt += `Q: ${entry.question}\nA: ${entry.answer}\n\n`;
                } else if (entry.content) {
                    prompt += `${entry.content}\n\n`;
                }
            });
        }

        // Append booking rules summary
        const rules = getBookingRules(petroConfig);
        const workingDays = Object.entries(rules.working_hours || {})
            .filter(([_, v]) => v.is_working)
            .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(', ');

        prompt += `\n\n## BOOKING CONFIGURATION\n`;
        prompt += `- Agent Name: ${agentName}\n`;
        prompt += `- Slot Duration: ${rules.slot_duration} minutes\n`;
        prompt += `- Max Advance Booking: ${rules.max_advance_days} days\n`;
        prompt += `- Working Days: ${workingDays || 'Mon-Sat'}\n`;
        const requiredFields = (rules.required_fields || []).join(', ');
        if (requiredFields) {
            prompt += `- Required fields before booking: ${requiredFields}\n`;
        }
    }

    prompt += `\n\n[TODAY'S DATE: ${today}]`;

    return prompt;
}

/**
 * Build the dynamic system prompt from config + WhatsApp config.
 */
async function buildSystemPrompt(tenantId) {
    try {
        const [petroConfig, whatsAppConfig, settings] = await Promise.all([
            loadConfig(tenantId),
            prisma.whatsAppConfig.findFirst(tenantId ? { where: { tenantId } } : undefined),
            prisma.settings.findFirst(tenantId ? { where: { tenantId } } : undefined),
        ]);

        return compileSystemPrompt(petroConfig, whatsAppConfig, settings);
    } catch (error) {
        console.error('[PetroConfig] buildSystemPrompt error:', error.message);
        return FALLBACK_PROMPT + `\n\n[TODAY'S DATE: ${new Date().toDateString()}]`;
    }
}

/**
 * Get booking rules from config, merged with defaults.
 */
function getBookingRules(config) {
    if (!config) return DEFAULT_BOOKING_RULES;
    const rules = (typeof config.booking_rules === 'object' && config.booking_rules !== null)
        ? config.booking_rules
        : {};
    return {
        ...DEFAULT_BOOKING_RULES,
        ...rules,
        working_hours: {
            ...DEFAULT_BOOKING_RULES.working_hours,
            ...(rules.working_hours || {}),
        },
        required_fields: rules.required_fields || DEFAULT_BOOKING_RULES.required_fields,
    };
}

/**
 * Get only the enabled tools for this config.
 * Returns a filtered subset of the full tool definition list.
 */
function getEnabledToolNames(config) {
    if (!config || !config.tools_enabled || config.tools_enabled.length === 0) {
        return DEFAULT_TOOLS;
    }
    return config.tools_enabled.filter(t => ALL_TOOLS.includes(t));
}

/**
 * Full config loader API.
 */
async function getPetroConfig(tenantId) {
    return await loadConfig(tenantId);
}

module.exports = {
    buildSystemPrompt,
    compileSystemPrompt,
    loadConfig,
    getPetroConfig,
    getBookingRules,
    getEnabledToolNames,
    invalidateCache,
    ALL_TOOLS,
    DEFAULT_TOOLS,
    DEFAULT_BOOKING_RULES,
};
