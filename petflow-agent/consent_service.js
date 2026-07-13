/**
 * consent_service.js
 * 
 * Handles GDPR / DPDP / PDPL consent collection and management in the AI agent.
 * All data collection must be preceded by informed consent.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Consent Message Templates ────────────────────────────────────────────────

const CONSENT_MESSAGE = `🐾 Welcome to *{SPA_NAME}*!

Before we get started, we need your permission to store your name and contact details to manage your pet's appointments and care.

📋 *What we collect:* Your name, phone number, and pet details.
🎯 *Why:* To book appointments, send reminders, and manage your pet's records.
🔒 *Your rights:* You can request access, correction, or deletion of your data at any time by replying *MY DATA*.

By replying *YES*, you agree to our Privacy Policy and consent to us storing your information.

Reply *YES* to continue, or *NO* to decline.`;

const MARKETING_OPT_IN_MESSAGE = `📣 *One more thing!*

Would you also like to receive occasional promotions, special offers, and grooming tips?

Reply *YES* for marketing updates, or *NO* to skip (you can still book appointments either way).
Reply *STOP* at any time to unsubscribe from marketing messages.`;

const CONSENT_DECLINED_MESSAGE = `We understand! We won't store your personal data.

If you'd like to book an appointment, please contact us directly during business hours or call us.

Thank you for reaching out! 🐾`;

const CONSENT_ALREADY_GIVEN_MESSAGE = null; // null = no message, just proceed

// Opt-out footer appended to every marketing message (can be customized)
const MARKETING_OPT_OUT_FOOTER = `\n\n_Reply STOP to unsubscribe from marketing messages._`;

// ─── Consent Status Check ─────────────────────────────────────────────────────

/**
 * Returns the consent status for a given phone number.
 * @returns {Object} { hasConsent: bool, hasDeclined: bool, client: object|null }
 */
async function getConsentStatus(phone, tenantId) {
    const client = await prisma.client.findFirst({
        where: {
            whatsapp_number: phone,
            ...(tenantId ? { tenantId } : {})
        }
    });

    if (!client) {
        return { hasConsent: false, hasDeclined: false, client: null };
    }

    if (client.is_anonymized) {
        return { hasConsent: false, hasDeclined: true, client };
    }

    return {
        hasConsent: client.consent_given,
        hasDeclined: false,
        client
    };
}

// ─── Consent Collection Flow ──────────────────────────────────────────────────

/**
 * Checks if a message is a consent grant.
 */
function isConsentGrant(text) {
    const normalized = text.trim().toUpperCase();
    return ['YES', 'Y', 'AGREE', 'ACCEPT', 'OK', 'OKAY', 'SURE', 'हाँ', 'हां', 'ठीक है'].includes(normalized);
}

/**
 * Checks if a message is a consent decline.
 */
function isConsentDecline(text) {
    const normalized = text.trim().toUpperCase();
    return ['NO', 'N', 'DECLINE', 'REJECT', 'नहीं'].includes(normalized);
}

/**
 * Checks if a message is a STOP / marketing opt-out keyword.
 */
function isStopKeyword(text) {
    const normalized = text.trim().toUpperCase();
    return ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'STOPALL', 'CANCEL', 'END'].includes(normalized);
}

/**
 * Checks if a message is a data rights request.
 */
function isDataRightsRequest(text) {
    const normalized = text.trim().toUpperCase();
    return [
        'MY DATA', 'DELETE MY DATA', 'ERASE MY DATA', 'FORGET ME', 'ERASE ME',
        'MY RIGHTS', 'PRIVACY', 'DATA RIGHTS'
    ].includes(normalized);
}

/**
 * Specifically checks if user wants to DELETE / ERASE their data.
 */
function isErasureRequest(text) {
    const normalized = text.trim().toUpperCase();
    return ['DELETE MY DATA', 'ERASE MY DATA', 'FORGET ME', 'ERASE ME', 'DELETE ME'].includes(normalized);
}

/**
 * Checks if consent is pending for this session (we've asked but haven't received answer).
 */
async function isConsentPending(phone, tenantId) {
    const session = await prisma.chatSession.findUnique({
        where: { phone },
        include: { messages: { orderBy: { created: 'desc' }, take: 5 } }
    });

    if (!session) return false;

    // Check last few messages for consent ask marker
    const recentMessages = session.messages || [];
    return recentMessages.some(m =>
        m.role === 'assistant' &&
        m.content.includes('Reply *YES* to continue') &&
        // Only treat as pending if within last 24 hours
        (Date.now() - new Date(m.created).getTime()) < 24 * 60 * 60 * 1000
    );
}

// ─── Consent Grant ────────────────────────────────────────────────────────────

/**
 * Records consent for a client. Creates/updates client record with consent info.
 */
async function recordConsent(phone, tenantId, channel = 'whatsapp') {
    const consentMessage = CONSENT_MESSAGE.replace('{SPA_NAME}', process.env.SPA_NAME || 'Pet Spa');

    const client = await prisma.client.findFirst({
        where: { whatsapp_number: phone, ...(tenantId ? { tenantId } : {}) }
    });

    if (client) {
        await prisma.client.update({
            where: { id: client.id },
            data: {
                consent_given: true,
                consent_date: new Date(),
                consent_channel: channel
            }
        });

        await prisma.consentLog.create({
            data: {
                tenantId,
                client_id: client.id,
                phone,
                event: 'granted',
                channel,
                message_text: consentMessage
            }
        });

        return client;
    }

    // Client doesn't exist yet — store consent flag in session for when profile is created
    // We'll use a temporary session note
    await prisma.chatSession.upsert({
        where: { phone },
        update: { updated: new Date() },
        create: {
            phone,
            tenantId,
            channel
        }
    });

    // Log the consent event even before profile creation
    await prisma.consentLog.create({
        data: {
            tenantId,
            phone,
            event: 'granted',
            channel,
            message_text: consentMessage
        }
    });

    return null;
}

/**
 * Records marketing opt-in for a client.
 */
async function recordMarketingOptIn(phone, tenantId, channel = 'whatsapp') {
    const client = await prisma.client.findFirst({
        where: { whatsapp_number: phone, ...(tenantId ? { tenantId } : {}) }
    });

    if (client) {
        await prisma.client.update({
            where: { id: client.id },
            data: { marketing_opt_in: true, marketing_opt_out_at: null }
        });

        await prisma.consentLog.create({
            data: {
                tenantId,
                client_id: client.id,
                phone,
                event: 'marketing_opt_in',
                channel
            }
        });
    }
}

/**
 * Records marketing opt-out (STOP keyword) for a client.
 */
async function recordMarketingOptOut(phone, tenantId, channel = 'whatsapp') {
    const client = await prisma.client.findFirst({
        where: { whatsapp_number: phone, ...(tenantId ? { tenantId } : {}) }
    });

    if (client) {
        await prisma.client.update({
            where: { id: client.id },
            data: { marketing_opt_in: false, marketing_opt_out_at: new Date() }
        });

        await prisma.consentLog.create({
            data: {
                tenantId,
                client_id: client.id,
                phone,
                event: 'stop_keyword',
                channel,
                message_text: 'User sent STOP keyword'
            }
        });
    }

    return '✅ You have been unsubscribed from marketing messages. You will still receive appointment reminders and important service updates. Reply *YES* to re-subscribe at any time.';
}

// ─── Post-Profile-Creation: Apply Pending Consent ────────────────────────────

/**
 * Called after the AI creates a client profile — applies the pending consent
 * grant that was collected before the profile was created.
 */
async function applyPendingConsentToClient(phone, clientId, tenantId) {
    // Check if there's a pending consent log for this phone (no client_id yet)
    const pendingConsent = await prisma.consentLog.findFirst({
        where: { phone, client_id: null, event: 'granted' },
        orderBy: { created: 'desc' }
    });

    if (pendingConsent) {
        // Link the consent log to the new client
        await prisma.consentLog.update({
            where: { id: pendingConsent.id },
            data: { client_id: clientId }
        });

        // Update the client with consent info
        await prisma.client.update({
            where: { id: clientId },
            data: {
                consent_given: true,
                consent_date: pendingConsent.created,
                consent_channel: pendingConsent.channel
            }
        });
    }
}

// ─── Build Consent Message ────────────────────────────────────────────────────

function buildConsentMessage(spaName) {
    return CONSENT_MESSAGE.replace('{SPA_NAME}', spaName || 'Pet Spa');
}

function buildMarketingOptInMessage() {
    return MARKETING_OPT_IN_MESSAGE;
}

module.exports = {
    getConsentStatus,
    isConsentGrant,
    isConsentDecline,
    isStopKeyword,
    isDataRightsRequest,
    isConsentPending,
    recordConsent,
    recordMarketingOptIn,
    recordMarketingOptOut,
    applyPendingConsentToClient,
    buildConsentMessage,
    buildMarketingOptInMessage,
    CONSENT_DECLINED_MESSAGE,
    MARKETING_OPT_OUT_FOOTER
};
