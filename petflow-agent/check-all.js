/**
 * check-all.js — PetFlow Spa WhatsApp Agent
 * Validates all environment variables and connections before going live.
 *
 * Usage: node check-all.js
 */

require('dotenv').config();

const checks = [];

function ok(label, detail = '') {
    checks.push({ status: '✅', label, detail });
}
function fail(label, detail = '') {
    checks.push({ status: '❌', label, detail });
}
function warn(label, detail = '') {
    checks.push({ status: '⚠️ ', label, detail });
}

async function runChecks() {
    console.log('\n🐾 PetFlow WhatsApp Agent — Pre-flight Check\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ── Check env vars ─────────────────────────────────────────────────────
    const evoUrl  = process.env.EVOLUTION_API_URL;
    const evoKey  = process.env.EVOLUTION_API_KEY;
    const aiKey   = process.env.OPENAI_API_KEY;
    const instName= process.env.INSTANCE_NAME;
    const agentUrl= process.env.AGENT_PUBLIC_URL;
    const booking = process.env.BOOKING_LINK;
    const spaName = process.env.SPA_NAME;

    evoUrl   ? ok('EVOLUTION_API_URL',   evoUrl)                    : fail('EVOLUTION_API_URL',   'Not set in .env');
    evoKey   ? ok('EVOLUTION_API_KEY',   '***' + evoKey.slice(-4))  : fail('EVOLUTION_API_KEY',   'Not set in .env');
    aiKey    ? ok('OPENAI_API_KEY',      '***' + aiKey.slice(-4))   : fail('OPENAI_API_KEY',      'Not set in .env');
    instName ? ok('INSTANCE_NAME',       instName)                  : warn('INSTANCE_NAME',       'Not set — defaulting to PetFlow_Spa');
    agentUrl ? ok('AGENT_PUBLIC_URL',    agentUrl)                  : warn('AGENT_PUBLIC_URL',    'Not set — needed for set-webhook.js');
    booking  ? ok('BOOKING_LINK',        booking)                   : warn('BOOKING_LINK',        'Not set — Luna won\'t share booking link');
    spaName  ? ok('SPA_NAME',            spaName)                   : warn('SPA_NAME',            'Not set — defaulting to PetFlow Spa');

    // ── Check prompt file ──────────────────────────────────────────────────
    const fs   = require('fs');
    const path = require('path');
    const promptFile = path.join(__dirname, 'pet_spa_prompt.md');
    if (fs.existsSync(promptFile)) {
        const size = fs.statSync(promptFile).size;
        ok('pet_spa_prompt.md', `Found (${size} bytes)`);
    } else {
        fail('pet_spa_prompt.md', 'File not found! Luna has no personality 😱');
    }

    // ── Test Evolution API connection ──────────────────────────────────────
    if (evoUrl && evoKey) {
        try {
            const cleanUrl = evoUrl.endsWith('/') ? evoUrl.slice(0, -1) : evoUrl;
            const res = await fetch(`${cleanUrl}/instance/fetchInstances`, {
                headers: { 'apikey': evoKey }
            });
            if (res.ok) {
                const data = await res.json();
                const count = Array.isArray(data) ? data.length : '?';
                ok('Evolution API Connection', `Reachable — ${count} instance(s) found`);

                // Check if our instance exists
                const inst = instName || 'PetFlow_Spa';
                const found = Array.isArray(data) && data.find(i => (i.instance?.instanceName === inst || i.name === inst));
                found
                    ? ok(`Instance "${inst}"`, `State: ${found.connectionStatus || found.instance?.state || 'unknown'}`)
                    : warn(`Instance "${inst}"`, 'Not found — create it in Evolution API dashboard');
            } else {
                fail('Evolution API Connection', `HTTP ${res.status} — check URL and API key`);
            }
        } catch (e) {
            fail('Evolution API Connection', `Cannot reach server: ${e.message}`);
        }
    } else {
        warn('Evolution API Connection', 'Skipped — missing URL or key');
    }

    // ── Print results ──────────────────────────────────────────────────────
    console.log('');
    for (const c of checks) {
        const detail = c.detail ? `  →  ${c.detail}` : '';
        console.log(`  ${c.status}  ${c.label}${detail}`);
    }

    const failures = checks.filter(c => c.status === '❌').length;
    const warnings = checks.filter(c => c.status.includes('⚠️')).length;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    if (failures === 0 && warnings === 0) {
        console.log('🎉 All checks passed! Run: node index.js\n');
    } else if (failures === 0) {
        console.log(`⚠️  ${warnings} warning(s) — agent will start but some features may be limited.`);
        console.log('   Run: node index.js\n');
    } else {
        console.log(`❌ ${failures} error(s) found. Fix them before starting the agent.\n`);
        process.exit(1);
    }
}

runChecks().catch(e => {
    console.error('\n❌ Check script error:', e.message);
    process.exit(1);
});
