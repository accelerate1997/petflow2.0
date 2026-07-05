require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('./encryption');

/**
 * instagram.js — PetFlow Spa Instagram DM Agent
 * Sends messages via Meta Messenger API with typing simulation.
 */

async function sendMessage(remoteJid, text) {
    try {
        // Clean the recipient ID (strip 'instagram:' prefix)
        const cleanTo = remoteJid.replace('instagram:', '').replace(/\D/g, '');

        // Find the active session for this recipient to resolve tenant ID
        const session = await prisma.chatSession.findUnique({
            where: { phone: remoteJid } // stored as 'instagram:1234567890'
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

        const accessToken = config?.instagram_page_access_token 
            ? decrypt(config.instagram_page_access_token) 
            : process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

        if (!accessToken) {
            console.error('❌ Instagram Page Access Token is missing. Cannot send message.');
            return false;
        }

        console.log(`📡 Sending Instagram DM to ${cleanTo}...`);

        // Send "typing_on" sender action to show typing bubble in Instagram
        const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: cleanTo },
                    sender_action: 'typing_on'
                })
            });
        } catch (e) {
            // ignore typing_on errors
        }

        // Simulate typing delay based on reply length (min 2.5s, max 8s)
        const typingDelay = Math.max(2500, Math.min(8000, text.length * 40));
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        // Send actual text message
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: cleanTo },
                message: { text: text }
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Instagram DM sent! Message ID: ${result.message_id}`);
            return true;
        } else {
            console.error(`❌ Failed to send Instagram DM. HTTP ${response.status}`);
            console.error('❌ Meta API Error:', JSON.stringify(result, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Instagram message:', error);
        return false;
    }
}

/**
 * Sends media/image message via Meta API
 */
async function sendMedia(remoteJid, mediaUrl, caption) {
    try {
        const cleanTo = remoteJid.replace('instagram:', '').replace(/\D/g, '');

        const session = await prisma.chatSession.findUnique({
            where: { phone: remoteJid }
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

        const accessToken = config?.instagram_page_access_token 
            ? decrypt(config.instagram_page_access_token) 
            : process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

        if (!accessToken) {
            console.error('❌ Instagram Page Access Token is missing for media. Cannot send.');
            return false;
        }

        console.log(`📡 Sending Instagram Media to ${cleanTo}...`);

        const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`;

        // For Instagram, we send an attachment payload
        const payload = {
            recipient: { id: cleanTo },
            message: {
                attachment: {
                    type: 'image',
                    payload: {
                        url: mediaUrl,
                        is_reusable: true
                    }
                }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Instagram Media sent! Message ID: ${result.message_id}`);
            // If caption is provided, send it as a follow-up text message
            if (caption) {
                await sendMessage(remoteJid, caption);
            }
            return true;
        } else {
            console.error('❌ Meta Media send failed:', JSON.stringify(result, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending Instagram media:', error);
        return false;
    }
}

module.exports = { sendMessage, sendMedia };
