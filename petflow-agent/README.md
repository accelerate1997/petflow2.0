# PetFlow WhatsApp AI Agent 🐾

> **Luna** — The smart, loving AI assistant for PetFlow Spa. Handles WhatsApp leads 24/7, qualifies pet parents, and books grooming appointments — all automatically.

---

## How It Works

```
Pet Parent (WhatsApp) → Evolution API → This Agent (webhook)
                                               ↓
                                        OpenAI GPT-4o-mini
                                               ↓
                                   Luna's Reply → Evolution API → Pet Parent
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create your `.env` file
```bash
cp .env.example .env
```
Fill in your values in `.env`:
```env
OPENAI_API_KEY=sk-...
EVOLUTION_API_URL=https://your-evolution-server.com
EVOLUTION_API_KEY=your-evolution-key
INSTANCE_NAME=PetFlow_Spa
AGENT_PUBLIC_URL=https://your-public-url.com
BOOKING_LINK=https://cal.com/your-link
SPA_NAME=PetFlow Spa
PORT=3002
```

### 3. Run pre-flight checks
```bash
node check-all.js
```

### 4. Register the webhook (run once)
```bash
node set-webhook.js
```

### 5. Start the agent
```bash
npm start
```

---

## Files

| File | Purpose |
|------|---------|
| `index.js` | Main Express server — receives webhooks, orchestrates responses |
| `ai_service.js` | OpenAI integration — session memory, prompt injection |
| `evolution.js` | Evolution API — sends WhatsApp messages with typing delay |
| `pet_spa_prompt.md` | Luna's personality & conversation flow |
| `set-webhook.js` | Registers webhook with Evolution API (run once) |
| `check-all.js` | Pre-flight validation of all env vars & connections |
| `.env.example` | Environment variable template |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Agent status, active sessions, recent messages |
| `POST` | `/webhook` | Evolution API posts here on new WhatsApp messages |
| `POST` | `/api/session/clear` | Clear a user's conversation `{ "phone": "91XXXXXXXXXX" }` |
| `GET`  | `/api/session/info?phone=...` | View session details for a number |
| `GET`  | `/api/sessions` | List all active sessions |

---

## Customising Luna

Edit `pet_spa_prompt.md` to change:
- Luna's personality and tone
- Services offered and pricing
- Conversation stages
- FAQ answers

The file is loaded at runtime — restart the agent after edits.

---

## Local Testing with ngrok

If running locally, expose port 3002 with ngrok:
```bash
ngrok http 3002
```
Copy the `https://...ngrok.io` URL → set as `AGENT_PUBLIC_URL` in `.env` → run `node set-webhook.js`

---

## Production Deployment

For production, deploy to any Node.js host (Railway, Render, VPS, etc.):
1. Set all env vars on the host
2. Run `npm start`
3. Run `node set-webhook.js` once to register the webhook
4. Agent runs 24/7 ✅
