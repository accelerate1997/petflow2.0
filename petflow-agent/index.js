require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { processMessage, clearSession, getActiveSessions, getSessionInfo } = require('./ai_service');
const twilioClient = require('./twilio');
const instagramClient = require('./instagram');
const consentService = require('./consent_service');

async function sendReply(remoteJid, text) {
    if (remoteJid.startsWith('instagram:')) {
        return await instagramClient.sendMessage(remoteJid, text);
    } else {
        return await twilioClient.sendMessage(remoteJid, text);
    }
}
const { initAutomation } = require('./automation_service');
const rateLimit = require('express-rate-limit');

const app  = express();
app.set('trust proxy', 1); // Trust Coolify/Traefik reverse proxy for correct IP detection
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiters Configuration ──────────────────────────────────────────────
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    message: { error: 'Too many requests to webhook endpoint' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per 15 minutes
    message: { error: 'Too many API requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Loop prevention cache (phone -> timestamps[])
const messageTimeline = new Map();

function checkBotLoop(phone) {
    const now = Date.now();
    let timestamps = messageTimeline.get(phone) || [];
    
    // Filter to last 10 seconds
    timestamps = timestamps.filter(ts => now - ts < 10000);
    timestamps.push(now);
    messageTimeline.set(phone, timestamps);

    // Block if more than 10 messages in 10 seconds
    return timestamps.length > 10;
}

// Clean stale numbers from timeline cache every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [phone, ts] of messageTimeline.entries()) {
        const fresh = ts.filter(t => now - t < 10000);
        if (fresh.length === 0) {
            messageTimeline.delete(phone);
        } else {
            messageTimeline.set(phone, fresh);
        }
    }
}, 5 * 60 * 1000);

const server = http.createServer(app);
const prisma = new PrismaClient();

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
];

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
                              origin.includes('pinggy-free.link') || 
                              origin.includes('192.168.') ||
                              (process.env.AGENT_PUBLIC_URL && origin.includes(new URL(process.env.AGENT_PUBLIC_URL).hostname));
            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"]
    }
});

const PORT          = process.env.PORT          || 3002;
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'PetFlow_Spa';
const SPA_NAME      = process.env.SPA_NAME      || 'PetFlow Spa';
const API_KEY       = process.env.PETFLOW_API_KEY;

// ─── Socket.io Authentication Middleware ──────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!API_KEY) {
        console.warn('⚠️ PETFLOW_API_KEY is not set. Socket security is disabled.');
        return next();
    }
    if (token === API_KEY) {
        return next();
    }
    console.warn(`[SOCKET] Unauthorized connection attempt from ${socket.id}`);
    return next(new Error('Unauthorized: Invalid API Key'));
});

io.on('connection', (socket) => {
    console.log(`🔌 Client connected to WebSockets: ${socket.id}`);

    // Join room based on selected session
    socket.on('join_session', (sessionId) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        socket.join(sessionId);
        console.log(`👥 Socket ${socket.id} joined room/session: ${sessionId}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected from WebSockets: ${socket.id}`);
    });
});

// ─── De-duplication Cache ─────────────────────────────────────────────────────
const processedMessages = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function isDuplicate(id) {
    const now = Date.now();
    if (processedMessages.has(id)) return true;
    processedMessages.set(id, now);
    if (processedMessages.size > 1000) {
        for (const [key, ts] of processedMessages.entries()) {
            if (now - ts > CACHE_TTL) processedMessages.delete(key);
        }
    }
    return false;
}

// ─── Recent Webhook Debug Log ─────────────────────────────────────────────────
const recentWebhooks = [];

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status:         'PETRO_ALIVE',
        agent:          `Petro | ${SPA_NAME} WhatsApp AI`,
        instance:       INSTANCE_NAME,
        activeSessions: getActiveSessions().length,
        uptime:         process.uptime().toFixed(0) + 's'
    });
});

// ─── Debug: Recent Webhooks ────────────────────────────────────────────────────
app.get('/debug/recent', (req, res) => {
    const key = req.headers['apikey'] || req.headers['x-api-key'] || req.query.apikey;
    if (API_KEY && key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ recentWebhooks, activeSessions: getActiveSessions() });
});

// ─── Webhook (Protected) ──────────────────────────────────────────────────────
app.post('/webhook', webhookLimiter, async (req, res) => {
    const isTwilio = !!(req.body.From || req.body.AccountSid);
    const requestApiKey = req.headers['apikey'] || req.headers['x-api-key'] || req.query.apikey;
    const localApiKey = process.env.EVOLUTION_API_KEY;
    const petflowApiKey = process.env.PETFLOW_API_KEY;

    const hasExpectedKeys = !!(localApiKey || petflowApiKey);
    const matchesAnyKey = (localApiKey && requestApiKey === localApiKey) || (petflowApiKey && requestApiKey === petflowApiKey);

    if (!isTwilio && hasExpectedKeys && !matchesAnyKey) {
        console.warn(`[WEBHOOK] Unauthorized connection attempt. Invalid apikey.`);
        return res.status(401).json({ error: 'Unauthorized: Invalid apikey header' });
    }

    try {
        let text, phone, remoteJid, msgId;

        if (isTwilio) {
            msgId = req.body.MessageSid;
            const from = req.body.From || '';
            phone = from.replace('whatsapp:', '').replace(/\D/g, '');
            remoteJid = from;
            text = req.body.Body;

            console.log(`\n🔥 TWILIO WEBHOOK: Incoming from ${phone}`);
        } else {
            const { event, data } = req.body;
            console.log(`\n🔥 EVOLUTION WEBHOOK: ${event}`);

            if (event !== 'messages.upsert') {
                return res.sendStatus(200);
            }

            const msg = Array.isArray(data) ? data[0] : data;
            const rawTs = msg?.messageTimestamp;
            if (rawTs) {
                const ageSeconds = Math.floor(Date.now() / 1000) - rawTs;
                if (ageSeconds > 60 && ageSeconds < 3600) {
                    console.log(`[IGNORE] Old message (${ageSeconds}s old). Skipping.`);
                    return res.sendStatus(200);
                }
            }

            const key       = msg?.key;
            msgId     = key?.id;
            remoteJid = key?.remoteJid;
            const fromMe    = key?.fromMe;
            const message   = msg?.message;

            if (msgId && isDuplicate(msgId)) {
                console.log(`[IGNORE] Duplicate msg: ${msgId}`);
                return res.sendStatus(200);
            }

            if (!message || !remoteJid) return res.sendStatus(200);

            const cleanPhone = remoteJid.split('@')[0];

            // Outgoing message (sent from CRM or phone app)
            if (fromMe) {
                const session = await prisma.chatSession.findUnique({
                    where: { phone: cleanPhone }
                });
                if (session) {
                    const textContent =
                        message.conversation ||
                        message.extendedTextMessage?.text ||
                        message.imageMessage?.caption ||
                        message.videoMessage?.caption;

                    if (textContent) {
                        // Check if already in DB (to prevent double-saving CRM replies)
                        const existing = await prisma.chatMessage.findFirst({
                            where: {
                                session_id: session.id,
                                role: 'assistant',
                                content: textContent,
                                created: { gte: new Date(Date.now() - 20000) }
                            }
                        });

                        let msgToBroadcast;
                        if (!existing) {
                            msgToBroadcast = await prisma.chatMessage.create({
                                data: {
                                    session_id: session.id,
                                    role: 'assistant',
                                    content: textContent
                                }
                            });
                            await prisma.chatSession.update({
                                where: { id: session.id },
                                data: {
                                    last_message: textContent.slice(0, 100),
                                    updated: new Date()
                                }
                            });
                        } else {
                            msgToBroadcast = existing;
                        }

                        // Broadcast via sockets to update CRM screens
                        io.to(session.id).emit('new_message', msgToBroadcast);
                        io.emit('session_updated', {
                            sessionId: session.id,
                            lastMessage: textContent.slice(0, 100)
                        });
                    }
                }
                return res.sendStatus(200);
            }

            if (remoteJid.includes('@g.us')) {
                console.log('[IGNORE] Group message — skipping.');
                return res.sendStatus(200);
            }

            text =
                message.conversation ||
                message.extendedTextMessage?.text ||
                message.imageMessage?.caption ||
                message.videoMessage?.caption;
            
            phone = cleanPhone;
        }

        if (msgId && !isTwilio && isDuplicate(msgId)) {
            console.log(`[IGNORE] Duplicate msg: ${msgId}`);
            return;
        }

        if (!text || !phone || !remoteJid) {
            return res.status(200).end();
        }

        res.status(200).end();

        if (checkBotLoop(phone)) {
            console.warn(`⚠️ [SAFETY TRIGGER] Bot loop detected for phone ${phone}. Suppressing AI response.`);
            return;
        }
        console.log(`\n📨 From ${phone}: ${text}`);

        recentWebhooks.unshift({
            time:  new Date().toISOString(),
            phone,
            text:  text.substring(0, 60)
        });
        if (recentWebhooks.length > 10) recentWebhooks.pop();

        // ─── GDPR / DPDP: Handle special keywords BEFORE anything else ──────

        // Handle STOP keyword (marketing opt-out) — respond immediately
        if (consentService.isStopKeyword(text)) {
            console.log(`[CONSENT] STOP keyword from ${phone}`);
            const stopReply = await consentService.recordMarketingOptOut(phone, null, isTwilio ? 'twilio' : 'whatsapp');
            await sendReply(remoteJid, stopReply);
            return;
        }

        // Handle MY DATA / data rights keyword — provide data rights information
        if (consentService.isDataRightsRequest(text)) {
            console.log(`[CONSENT] Data rights request from ${phone}`);

            // Check if it's specifically a deletion/erasure request
            if (consentService.isErasureRequest(text)) {
                const crmUrl = process.env.CRM_PUBLIC_URL || process.env.NEXTAUTH_URL || 'https://yourpetflow.com';
                const deleteUrl = `${crmUrl}/delete-my-data`;
                const erasureMsg =
                    `🗑️ *Delete Your Data*\n\n` +
                    `You can submit a data deletion request using the link below. It takes less than a minute:\n\n` +
                    `🔗 ${deleteUrl}\n\n` +
                    `Once submitted, we will:\n` +
                    `✅ Remove your name, phone, email & address\n` +
                    `✅ Delete your chat history\n` +
                    `⚠️ Keep invoices for legal compliance\n\n` +
                    `You will receive a reference ID and we will complete it within *7 days* (as required by the DPDP Act).\n\n` +
                    `_If you have any questions, please contact the spa directly._`;
                await sendReply(remoteJid, erasureMsg);
            } else {
                const crmUrl = process.env.CRM_PUBLIC_URL || process.env.NEXTAUTH_URL || 'https://yourpetflow.com';
                const dataRightsMsg =
                    `🔒 *Your Data Rights*\n\n` +
                    `We store your name, phone number, and appointment history to manage your pet's care.\n\n` +
                    `You have the right to:\n` +
                    `• *Access* — Request a copy of your data\n` +
                    `• *Correct* — Update any incorrect information\n` +
                    `• *Delete* — Ask us to erase your data\n` +
                    `• *Unsubscribe* — Reply STOP to stop marketing messages\n\n` +
                    `To exercise any of these rights:\n` +
                    `🔗 ${crmUrl}/delete-my-data\n\n` +
                    `Or reply *DELETE MY DATA* to start a deletion request.\n\n` +
                    `_Your data is protected under DPDP Act 🇮🇳 / PDPL 🇦🇪 / CCPA 🇺🇸_`;
                await sendReply(remoteJid, dataRightsMsg);
            }
            return;
        }

        // ─── GDPR / DPDP: Consent Gate ──────────────────────────────────────
        // Every new user must give consent before we collect/store their data

        const { hasConsent, hasDeclined, client } = await consentService.getConsentStatus(phone, null);

        if (hasDeclined) {
            // Client previously declined — do not process
            console.log(`[CONSENT] Declined client ${phone} — not processing message.`);
            return;
        }

        if (!hasConsent) {
            // Check if we've already asked for consent and are waiting for a reply
            const isPending = await consentService.isConsentPending(phone, null);

            if (isPending) {
                // We asked, now check what they replied
                if (consentService.isConsentGrant(text)) {
                    console.log(`[CONSENT] Consent GRANTED by ${phone}`);
                    await consentService.recordConsent(phone, null, isTwilio ? 'twilio' : 'whatsapp');
                    // Now ask about marketing opt-in
                    const marketingMsg = consentService.buildMarketingOptInMessage();
                    await sendReply(remoteJid, marketingMsg);
                    return;
                } else if (consentService.isConsentDecline(text)) {
                    console.log(`[CONSENT] Consent DECLINED by ${phone}`);
                    await sendReply(remoteJid, consentService.CONSENT_DECLINED_MESSAGE);
                    return;
                } else {
                    // Check if they're answering the marketing opt-in question
                    const { hasConsent: nowHasConsent } = await consentService.getConsentStatus(phone, null);
                    if (nowHasConsent) {
                        if (consentService.isConsentGrant(text)) {
                            await consentService.recordMarketingOptIn(phone, null, isTwilio ? 'twilio' : 'whatsapp');
                            // Fall through to processMessage
                        }
                        // Either way (YES or NO to marketing), proceed to chat
                    } else {
                        // Re-send consent message if they sent something else
                        const spaName = process.env.SPA_NAME || 'Pet Spa';
                        await sendReply(remoteJid, consentService.buildConsentMessage(spaName));
                        return;
                    }
                }
            } else {
                // First contact — send consent message
                console.log(`[CONSENT] First contact from ${phone} — sending consent message`);
                const spaName = process.env.SPA_NAME || 'Pet Spa';
                const consentMsg = consentService.buildConsentMessage(spaName);

                // Save the consent-ask as a chat session message so isPending works
                // Resolve tenantId for this new session
                const waConfigForTenant = await prisma.whatsAppConfig.findFirst({
                    where: { instance_name: INSTANCE_NAME }
                });
                const consentTenantId = waConfigForTenant?.tenantId || 'default-tenant-id';

                const session = await prisma.chatSession.upsert({
                    where: { phone },
                    update: { updated: new Date(), tenantId: consentTenantId },
                    create: { phone, channel: isTwilio ? 'twilio' : 'whatsapp', tenantId: consentTenantId }
                });
                await prisma.chatMessage.create({
                    data: { session_id: session.id, role: 'assistant', content: consentMsg }
                });

                const sendResult = await sendReply(remoteJid, consentMsg);
                console.log(`[CONSENT SEND] Reply to ${phone}: ${sendResult ? '✅ sent' : '❌ FAILED'}`);
                return;
            }
        }

        // ─── Consent verified — proceed with AI processing ───────────────────

        const readDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
        await new Promise(resolve => setTimeout(resolve, readDelay));

        const reply = await processMessage(text, phone, (savedMsg) => {
            // Publish every saved message to the connected socket room
            io.to(savedMsg.session_id).emit('new_message', savedMsg);
            if (savedMsg.role === 'user' || savedMsg.role === 'assistant') {
                io.emit('session_updated', {
                    sessionId: savedMsg.session_id,
                    lastMessage: savedMsg.content.slice(0, 100)
                });
            }
        });
        if (reply) {
            console.log(`💬 Petro → ${phone}: ${reply.substring(0, 80)}...`);
            const sendOk = await sendReply(remoteJid, reply);
            if (!sendOk) {
                console.error(`❌ [SEND FAILED] Could not deliver reply to ${phone} via ${isTwilio ? 'Twilio' : 'Evolution'}`);
            }
        } else {
            console.log(`👤 [MANUAL MODE] Saved incoming message for ${phone}. AI response skipped.`);
        }

    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// ─── Instagram Webhook (GET Verification) ─────────────────────────────────────
app.get('/webhook/instagram', async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Find the configuration to verify the token
        const config = await prisma.whatsAppConfig.findFirst({
            where: { instagram_verify_token: { not: null } }
        });
        const verifyToken = config?.instagram_verify_token || process.env.INSTAGRAM_VERIFY_TOKEN || 'petflow_verify_token';

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[INSTAGRAM WEBHOOK] Verified successfully.');
            return res.status(200).send(challenge);
        } else {
            console.warn('[INSTAGRAM WEBHOOK] Verification failed. Tokens do not match.');
            return res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error verifying Instagram webhook:', error);
        return res.sendStatus(500);
    }
});

// ─── Instagram Webhook (POST Events) ──────────────────────────────────────────
app.post('/webhook/instagram', webhookLimiter, async (req, res) => {
    const requestApiKey = req.query.apikey || req.headers['apikey'] || req.headers['x-api-key'];
    const petflowApiKey = process.env.PETFLOW_API_KEY;

    if (petflowApiKey && requestApiKey !== petflowApiKey) {
        console.warn(`[INSTAGRAM WEBHOOK] Unauthorized connection attempt. Invalid apikey.`);
        return res.status(401).json({ error: 'Unauthorized: Invalid apikey header' });
    }

    try {
        const body = req.body;
        if (body.object === 'instagram') {
            for (const entry of body.entry) {
                if (!entry.messaging) continue;
                for (const messagingEvent of entry.messaging) {
                    if (messagingEvent.message && !messagingEvent.message.is_echo) {
                        const senderId = messagingEvent.sender.id;
                        const text = messagingEvent.message.text;

                        if (!text) continue;

                        const remoteJid = `instagram:${senderId}`;
                        const phone = remoteJid; // Stored prefixed in ChatSession
                        const msgId = messagingEvent.message.mid;

                        console.log(`\n🔥 INSTAGRAM WEBHOOK: Incoming from ${senderId}: ${text}`);

                        if (isDuplicate(msgId)) {
                            console.log(`[IGNORE] Duplicate Instagram message: ${msgId}`);
                            continue;
                        }

                        if (checkBotLoop(remoteJid)) {
                            console.warn(`⚠️ [SAFETY TRIGGER] Bot loop detected for Instagram user ${senderId}. Suppressing AI response.`);
                            continue;
                        }

                        recentWebhooks.unshift({
                            time: new Date().toISOString(),
                            phone: `ig:${senderId}`,
                            text: text.substring(0, 60)
                        });
                        if (recentWebhooks.length > 10) recentWebhooks.pop();

                        // Simulate small read/receive delay (1-2.5s)
                        const readDelay = Math.floor(Math.random() * 1500) + 1000;
                        await new Promise(resolve => setTimeout(resolve, readDelay));

                        // Process the Instagram message via Petro AI
                        processMessage(text, remoteJid, (savedMsg) => {
                            io.to(savedMsg.session_id).emit('new_message', savedMsg);
                            if (savedMsg.role === 'user' || savedMsg.role === 'assistant') {
                                io.emit('session_updated', {
                                    sessionId: savedMsg.session_id,
                                    lastMessage: savedMsg.content.slice(0, 100)
                                });
                            }
                        }).catch(err => {
                            console.error('[AI Instagram Processing Error]:', err);
                        });
                    }
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        } else {
            return res.sendStatus(404);
        }
    } catch (error) {
        console.error('Instagram Webhook error:', error);
        return res.sendStatus(500);
    }
});

// ─── Debug / Management Endpoints (Protected) ────────────────────────────────
app.use('/api/', apiLimiter);

app.post('/api/session/clear', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    clearSession(phone);
    res.json({ success: true });
});

app.get('/api/session/info', (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Phone query param required' });
    const info = getSessionInfo(phone);
    res.json(info);
});

app.get('/api/sessions', (req, res) => {
    res.json({ activeSessions: getActiveSessions() });
});

// ─── Petro Config API ─────────────────────────────────────────────────────────
const { invalidateCache } = require('./petro_config_loader');

app.get('/api/petro-config', async (req, res) => {
    try {
        const config = await prisma.petroConfig.findFirst({
            where: { is_active: true },
            orderBy: { created: 'desc' }
        });
        res.json({ success: true, config: config || null });
    } catch (error) {
        console.error('[PetroConfig GET]', error);
        res.status(500).json({ success: false, error: 'Failed to load config' });
    }
});

app.put('/api/petro-config', async (req, res) => {
    try {
        const data = req.body;
        const existing = await prisma.petroConfig.findFirst({
            where: { is_active: true },
            orderBy: { created: 'desc' }
        });

        let config;
        if (existing) {
            config = await prisma.petroConfig.update({
                where: { id: existing.id },
                data: {
                    agent_name: data.agent_name,
                    persona: data.persona,
                    tone: data.tone,
                    language: data.language,
                    booking_rules: data.booking_rules,
                    tools_enabled: data.tools_enabled,
                    knowledge_base: data.knowledge_base,
                    plan_tier: data.plan_tier,
                }
            });
        } else {
            config = await prisma.petroConfig.create({ data });
        }

        // Invalidate the in-memory cache so next message uses new config
        invalidateCache();

        res.json({ success: true, config });
    } catch (error) {
        console.error('[PetroConfig PUT]', error);
        res.status(500).json({ success: false, error: 'Failed to save config' });
    }
});

app.post('/api/petro-config/preview', async (req, res) => {
    try {
        const { message } = req.body;
        const { buildSystemPrompt } = require('./petro_config_loader');
        const systemPrompt = await buildSystemPrompt();
        res.json({ success: true, system_prompt: systemPrompt, message_received: message });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to build preview' });
    }
});

app.post('/api/petro-config/chat-preview', async (req, res) => {
    try {
        const { config, messages } = req.body;
        const { processPlaygroundMessage } = require('./ai_service');
        const result = await processPlaygroundMessage({ draftConfig: config, messages });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[PetroConfig Chat Preview]', error);
        res.status(500).json({ success: false, error: 'Failed to run playground simulation' });
    }
});


// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log('\n🌟🌟🌟 PETRO STARTUP 🌟🌟🌟');
    console.log(`🐾 Petro | ${SPA_NAME} WhatsApp AI Agent running on port ${PORT}`);
    console.log(`📱 Instance: ${INSTANCE_NAME}`);
    console.log(`🔗 Webhook:  POST http://localhost:${PORT}/webhook`);
    console.log(`❤️  Health:   GET  http://localhost:${PORT}/health\n`);
    console.log('▶️  Ready to handle WhatsApp messages!\n');

    // Initialize background automations
    initAutomation();
});

