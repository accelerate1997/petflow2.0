require('dotenv').config();
const OpenAI = require('openai');

const openAiKey = process.env.OPENAI_API_KEY || '';
const clientOptions = { apiKey: openAiKey };
if (openAiKey.startsWith('sk-or-') || openAiKey.includes('openrouter')) {
    clientOptions.baseURL = "https://openrouter.ai/api/v1";
    clientOptions.defaultHeaders = {
        "HTTP-Referer": "https://petflow.io",
        "X-Title": "PetFlow CRM",
    };
}
const openai = new OpenAI(clientOptions);

const modelName = process.env.OPENAI_MODEL || (
    (openAiKey.startsWith('sk-or-') || openAiKey.includes('openrouter'))
        ? 'openai/gpt-4o-mini'
        : 'gpt-4o-mini'
);

async function test() {
    try {
        console.log(`📡 Connecting to model: ${modelName}...`);
        const response = await openai.chat.completions.create({
            model: modelName,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5
        });
        console.log('✅ Connection Successful!');
        console.log('Response:', response.choices[0].message.content);
    } catch (err) {
        console.error('❌ Connection Error:', err.message);
    }
}

test();
