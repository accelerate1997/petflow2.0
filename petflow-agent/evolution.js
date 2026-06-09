require('dotenv').config();

/**
 * evolution.js — PetFlow Spa WhatsApp Agent
 * Sends messages via Evolution API with human-like typing delay
 */

async function sendMessage(remoteJid, text, instanceName) {
    const evoUrlSource = process.env.EVOLUTION_API_URL || '';
    const evoUrl = evoUrlSource.endsWith('/') ? evoUrlSource.slice(0, -1) : evoUrlSource;
    const evoKey = process.env.EVOLUTION_API_KEY;

    if (!evoUrl || !evoKey) {
        console.error('❌ Evolution API keys missing in .env. Cannot send message.');
        return false;
    }

    try {
        const cleanNumber = remoteJid.replace('+', '').replace('@s.whatsapp.net', '');
        console.log(`📡 Sending to ${cleanNumber} via instance ${instanceName}...`);

        // Simulate human typing speed: ~55ms per character (min 4s, max 14s)
        const typingDelay = Math.max(4000, Math.min(14000, text.length * 55));

        // Actually wait before sending — guarantees delay at node level
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        const response = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evoKey
            },
            body: JSON.stringify({
                number: cleanNumber,
                options: {
                    delay: typingDelay,
                    presence: 'composing',
                    linkPreview: false
                },
                text: text
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Message sent successfully!');
            return true;
        } else {
            console.error('❌ Failed to send. HTTP', response.status);
            console.error('❌ Evolution API Error:', JSON.stringify(data, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

/**
 * Sends a media/image message via Evolution API
 */
async function sendMedia(remoteJid, mediaUrl, caption, instanceName) {
    const evoUrlSource = process.env.EVOLUTION_API_URL || '';
    const evoUrl = evoUrlSource.endsWith('/') ? evoUrlSource.slice(0, -1) : evoUrlSource;
    const evoKey = process.env.EVOLUTION_API_KEY;

    if (!evoUrl || !evoKey) {
        console.error('❌ Evolution API keys missing. Cannot send media.');
        return false;
    }

    try {
        const cleanNumber = remoteJid.replace('+', '').replace('@s.whatsapp.net', '');

        const response = await fetch(`${evoUrl}/message/sendMedia/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evoKey
            },
            body: JSON.stringify({
                number: cleanNumber,
                mediatype: 'image',
                media: mediaUrl,
                caption: caption || ''
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log('✅ Media sent successfully!');
            return true;
        } else {
            console.error('❌ Media send failed:', JSON.stringify(data, null, 2));
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending media:', error);
        return false;
    }
}

module.exports = { sendMessage, sendMedia };
