const fs = require('fs');
const path = require('path');

const agentUrl = 'https://hotmw-2401-4900-57e9-be39-ec68-1753-d7fd-cb95.run.pinggy-free.link';

// Update Agent .env
const agentEnvPath = path.join('c:', 'Users', 'jasha', 'OneDrive', 'Desktop', 'Pet flow', 'petflow-agent', '.env');
if (fs.existsSync(agentEnvPath)) {
    let content = fs.readFileSync(agentEnvPath, 'utf8');
    content = content.replace(/AGENT_PUBLIC_URL=.*/, `AGENT_PUBLIC_URL=${agentUrl}`);
    fs.writeFileSync(agentEnvPath, content);
    console.log('✅ Updated Agent .env');
}

// Update CRM .env
const crmEnvPath = path.join('c:', 'Users', 'jasha', 'OneDrive', 'Desktop', 'Pet flow', 'petflow-crm', '.env');
if (fs.existsSync(crmEnvPath)) {
    let content = fs.readFileSync(crmEnvPath, 'utf8');
    content = content.replace(/AGENT_PUBLIC_URL=.*/, `AGENT_PUBLIC_URL=${agentUrl}`);
    fs.writeFileSync(crmEnvPath, content);
    console.log('✅ Updated CRM .env');
}
