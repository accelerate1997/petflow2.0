require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('./encryption');

/**
 * twilio.js — PetFlow Spa WhatsApp/SMS Agent
 * Sends messages via Twilio API with simulated typing delay.
 */

async function sendMessage(remoteJid, text) {
    try {
        // Clean the recipient number to get only digits
        const cleanTo = remoteJid.replace('whatsapp:', '').replace(/\D/g, '');

        // Find the active session for this recipient to resolve tenant ID
        const session = await prisma.chatSession.findUnique({
            where: { phone: cleanTo }
        });

        // Load config based on the session's tenantId (or find first config as fallback)
        let config = null;
        if (session && session.tenantId) {
            config = await prisma.whatsAppConfig.findFirst({
                where: { tenantId: session.tenantId }
            });
        }
        if (!config) {
            config = await prisma.whatsAppConfig.findFirst();
        }

        const accountSid = config?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = config?.twilio_auth_token ? decrypt(config.twilio_auth_token) : process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = config?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            console.error('❌ Twilio configuration missing (Account SID, Auth Token, or Sender Number). Cannot send message.');
            return false;
        }

        // Format to and from numbers for Twilio
        let formattedTo = cleanTo;
        let formattedFrom = fromNumber;

        if (formattedFrom.startsWith('whatsapp:')) {
            if (!formattedTo.startsWith('whatsapp:')) {
                formattedTo = `whatsapp:+${formattedTo}`;
            }
        } else {
            if (!formattedTo.startsWith('+')) {
                formattedTo = `+${formattedTo}`;
            }
            if (!formattedFrom.startsWith('+')) {
                formattedFrom = `+${formattedFrom}`;
            }
        }

        console.log(`📡 Sending via Twilio to ${formattedTo} from ${formattedFrom}...`);

        // Simulate human typing speed: ~55ms per character (min 4s, max 14s)
        const typingDelay = Math.max(4000, Math.min(14000, text.length * 55));
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const params = new URLSearchParams();
        params.append('To', formattedTo);
        params.append('From', formattedFrom);
        params.append('Body', text);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Message sent via Twilio! SID: ${result.sid}`);
            return true;
        } else {
            console.error(`❌ Failed to send via Twilio. HTTP ${response.status}`);
            console.error('❌ Twilio Error:', JSON.stringify(result, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Twilio message:', error);
        return false;
    }
}

/**
 * Sends media/image message via Twilio (expects a public URL)
 */
async function sendMedia(remoteJid, mediaUrl, caption) {
    try {
        const cleanTo = remoteJid.replace('whatsapp:', '').replace(/\D/g, '');

        const session = await prisma.chatSession.findUnique({
            where: { phone: cleanTo }
        });

        let config = null;
        if (session && session.tenantId) {
            config = await prisma.whatsAppConfig.findFirst({
                where: { tenantId: session.tenantId }
            });
        }
        if (!config) {
            config = await prisma.whatsAppConfig.findFirst();
        }

        const accountSid = config?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = config?.twilio_auth_token ? decrypt(config.twilio_auth_token) : process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = config?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            console.error('❌ Twilio configuration missing for media. Cannot send.');
            return false;
        }

        let formattedTo = cleanTo;
        let formattedFrom = fromNumber;

        if (formattedFrom.startsWith('whatsapp:')) {
            if (!formattedTo.startsWith('whatsapp:')) {
                formattedTo = `whatsapp:+${formattedTo}`;
            }
        } else {
            if (!formattedTo.startsWith('+')) {
                formattedTo = `+${formattedTo}`;
            }
            if (!formattedFrom.startsWith('+')) {
                formattedFrom = `+${formattedFrom}`;
            }
        }

        console.log(`📡 Sending Twilio Media to ${formattedTo} from ${formattedFrom}...`);

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const params = new URLSearchParams();
        params.append('To', formattedTo);
        params.append('From', formattedFrom);
        params.append('Body', caption || '');
        params.append('MediaUrl', mediaUrl);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Media sent via Twilio! SID: ${result.sid}`);
            return true;
        } else {
            console.error('❌ Twilio Media send failed:', JSON.stringify(result, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Twilio media:', error);
        return false;
    }
}

module.exports = { sendMessage, sendMedia };
