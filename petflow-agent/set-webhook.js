require('dotenv').config();

async function setWebhook() {
    const evoUrlSource  = process.env.EVOLUTION_API_URL || '';
    const evoUrl        = evoUrlSource.endsWith('/') ? evoUrlSource.slice(0, -1) : evoUrlSource;
    const evoKey        = process.env.EVOLUTION_API_KEY;
    const instanceName  = process.env.INSTANCE_NAME    || 'petflow';
    const agentUrl      = process.env.AGENT_PUBLIC_URL;
    const petflowApiKey = process.env.PETFLOW_API_KEY;

    if (!evoUrl || !evoKey || !agentUrl || !petflowApiKey) {
        console.error('\n❌ Missing required env vars.');
        if (!petflowApiKey) console.error('   → PETFLOW_API_KEY is missing.');
        process.exit(1);
    }

    const webhookUrl = `${agentUrl}/webhook`;
    console.log(`\n🔧 Registering SECURE webhook for instance: ${instanceName}`);
    console.log(`📡 Webhook URL: ${webhookUrl}`);

    try {
        const response = await fetch(`${evoUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evoKey
            },
            body: JSON.stringify({
                webhook: {
                    enabled: true,
                    url: webhookUrl,
                    headers: {
                        "x-api-key": petflowApiKey
                    },
                    webhook_by_events: false,
                    webhook_base64: false,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE"
                    ]
                }
            })
        });

        const data = await response.json();
        console.log('\nResponse:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ Secure Webhook registered successfully!');
        } else {
            console.error('\n❌ Failed to register webhook.');
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

setWebhook();
