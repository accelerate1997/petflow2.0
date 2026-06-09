require('dotenv').config();
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5
        });
        console.log('✅ OpenAI Connected!');
        console.log('Response:', response.choices[0].message.content);
    } catch (err) {
        console.error('❌ OpenAI Error:', err.message);
    }
}

test();
