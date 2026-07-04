require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { processMessage, clearSession, getActiveSessions, getSessionInfo } = require('./ai_service');
const { initAutomation } = require('./automation_service');
const rateLimit = require('express-rate-limit');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app  = express();
app.use(cors());
app.use(express.json());

// ─── Rate Limiters Configuration ──────────────────────────────────────────────
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

// ─── Health Check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status:         'PETRO_ALIVE',
        agent:          `Petro | ${SPA_NAME} WhatsApp AI`,
        instance:       INSTANCE_NAME,
        activeSessions: getActiveSessions().length,
        uptime:         process.uptime().toFixed(0) + 's',
        whatsapp:       (client.info && client.info.wid) ? 'CONNECTED' : 'DISCONNECTED'
    });
});

// ─── MOCKED EVOLUTION API ENDPOINTS FOR OUTGOING CRM MESSAGES ──────────────────
app.post('/message/sendText/:instance', async (req, res) => {
    const { number, text } = req.body;
    if (!number || !text) return res.status(400).json({ error: 'Missing number or text' });

    try {
        const cleanNumber = number.replace('+', '').split('@')[0];
        const jid = `${cleanNumber}@c.us`;
        console.log(`📡 CRM Outgoing text to ${cleanNumber}...`);
        const sent = await client.sendMessage(jid, text);
        res.json({ success: true, key: { id: sent.id.id } });
    } catch (error) {
        console.error('❌ Error sending mock text:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/message/sendMedia/:instance', async (req, res) => {
    const { number, media, caption } = req.body;
    if (!number || !media) return res.status(400).json({ error: 'Missing number or media' });

    try {
        const cleanNumber = number.replace('+', '').split('@')[0];
        const jid = `${cleanNumber}@c.us`;
        const { MessageMedia } = require('whatsapp-web.js');
        const mediaObj = await MessageMedia.fromUrl(media);
        console.log(`📡 CRM Outgoing media to ${cleanNumber}...`);
        const sent = await client.sendMessage(jid, mediaObj, { caption: caption || '' });
        res.json({ success: true, key: { id: sent.id.id } });
    } catch (error) {
        console.error('❌ Error sending mock media:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/instance/connectionState/:instance', (req, res) => {
    const isReady = client.info && client.info.wid;
    res.json({
        instance: {
            state: isReady ? "open" : "close"
        }
    });
});

app.get('/instance/connect/:instance', (req, res) => {
    res.json({
        success: true,
        message: "Check your monitor for the Chrome browser window and scan the QR code."
    });
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

// ─── INITIALIZE WHATSAPP-WEB CLIENT ──────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // Opens Chromium browser window on screen
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n================================================================');
    console.log('🚀 [WHATSAPP-WEB] Scan the QR code in the browser window on your screen!');
    console.log('================================================================\n');
});

client.on('ready', () => {
    console.log('\n================================================================');
    console.log('🚀 [WHATSAPP-WEB] Client is ready and successfully authenticated!');
    console.log('================================================================\n');
});

// ─── WHATSAPP MESSAGE EVENT HANDLERS ─────────────────────────────────────────
client.on('message', async (msg) => {
    const remoteJid = msg.from; // e.g. '917304084690@c.us'
    if (remoteJid.includes('@g.us')) return;

    const text = msg.body;
    if (!text) return;

    const phone = remoteJid.split('@')[0];
    if (checkBotLoop(phone)) {
        console.warn(`⚠️ [SAFETY TRIGGER] Bot loop detected for phone ${phone}. Suppressing AI response.`);
        return;
    }
    console.log(`\n📨 Incoming WhatsApp from ${phone}: ${text}`);

    recentWebhooks.unshift({
        time:  new Date().toISOString(),
        phone,
        text:  text.substring(0, 60)
    });
    if (recentWebhooks.length > 10) recentWebhooks.pop();

    // Human typing simulation delay (2s to 4s before starting logic)
    const readDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
    await new Promise(resolve => setTimeout(resolve, readDelay));

    try {
        const reply = await processMessage(text, phone, (savedMsg) => {
            io.to(savedMsg.session_id).emit('new_message', savedMsg);
            if (savedMsg.role === 'user' || savedMsg.role === 'assistant') {
                io.emit('session_updated', {
                    sessionId: savedMsg.session_id,
                    lastMessage: savedMsg.content.slice(0, 100)
                });
            }
        });

        if (reply) {
            console.log(`💬 Luna reply → ${phone}: ${reply.substring(0, 80)}...`);
            
            // Simulate human typing speed before sending (min 4s, max 14s)
            const typingDelay = Math.max(4000, Math.min(14000, reply.length * 55));
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            
            await client.sendMessage(remoteJid, reply);
        } else {
            console.log(`👤 [MANUAL MODE] Saved incoming message for ${phone}. AI response skipped.`);
        }
    } catch (error) {
        console.error('❌ Error processing message:', error);
    }
});

// Sync outgoing messages sent from phone/CRM
client.on('message_create', async (msg) => {
    if (!msg.fromMe) return; // Only process outgoing messages sent from this phone

    const remoteJid = msg.to; // e.g. '917304084690@c.us'
    if (remoteJid.includes('@g.us')) return;

    const cleanPhone = remoteJid.split('@')[0];
    const text = msg.body;
    if (!text) return;

    try {
        const session = await prisma.chatSession.findUnique({
            where: { phone: cleanPhone }
        });
        if (session) {
            // Check if already in DB (to prevent double-saving CRM replies)
            const existing = await prisma.chatMessage.findFirst({
                where: {
                    session_id: session.id,
                    role: 'assistant',
                    content: text,
                    created: { gte: new Date(Date.now() - 20000) }
                }
            });

            let msgToBroadcast;
            if (!existing) {
                msgToBroadcast = await prisma.chatMessage.create({
                    data: {
                        session_id: session.id,
                        role: 'assistant',
                        content: text
                    }
                });
                await prisma.chatSession.update({
                    where: { id: session.id },
                    data: {
                        last_message: text.slice(0, 100),
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
                lastMessage: text.slice(0, 100)
            });
        }
    } catch (error) {
        console.error('❌ Error syncing outgoing message:', error);
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log('\n🌟🌟🌟 LOCAL PETRO STARTUP 🌟🌟🌟');
    console.log(`🐾 Petro | ${SPA_NAME} Local WhatsApp AI Agent running on port ${PORT}`);
    console.log(`📱 Mode: Local Browser Bridge (whatsapp-web.js)`);
    console.log(`❤️  Health: GET http://localhost:${PORT}/health\n`);
    console.log('▶️  Starting local WhatsApp Client browser...');
    
    // Initialize client and background automations
    client.initialize();
    initAutomation();
});
