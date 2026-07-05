import { prisma } from './prisma';
import { getCurrentTenantId } from './session-utils';
import { decrypt } from './encryption';
import fs from 'fs';
import path from 'path';

/**
 * Fetches the WhatsApp config scoped to the current tenant.
 * Falls back to environment variables if no DB config exists.
 */
async function getWhatsAppConfig(tenantId?: string) {
  // Resolve tenantId — either passed in or fetched from session
  let tid = tenantId;
  if (!tid) {
    try {
      tid = await getCurrentTenantId();
    } catch {
      // In cron/background contexts, tenantId must be passed explicitly
    }
  }

  // Fetch tenant-scoped config from DB
  const config = tid
    ? await prisma.whatsAppConfig.findFirst({ where: { tenantId: tid } })
    : null;

  const baseInstanceName = process.env.INSTANCE_NAME || 'petflow';
  const uniqueSuffix = (tid && tid !== 'default-tenant-id') ? tid.slice(-6).toLowerCase() : '';
  const defaultInstance = uniqueSuffix
    ? `${baseInstanceName}_${uniqueSuffix}`
    : baseInstanceName;

  const defaults = {
    evolution_api_url: process.env.EVOLUTION_API_URL || process.env.Evolution_api_url || '',
    evolution_api_key: process.env.EVOLUTION_API_KEY || process.env.Evolution_api_key || '',
    instance_name: defaultInstance,
    twilio_account_sid: process.env.TWILIO_ACCOUNT_SID || '',
    twilio_auth_token: process.env.TWILIO_AUTH_TOKEN || '',
    twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
  };

  if (config) {
    return {
      evolution_api_url: config.evolution_api_url || defaults.evolution_api_url,
      evolution_api_key: decrypt(config.evolution_api_key) || defaults.evolution_api_key,
      instance_name: config.instance_name || defaults.instance_name,
      twilio_account_sid: config.twilio_account_sid || defaults.twilio_account_sid,
      twilio_auth_token: config.twilio_auth_token ? decrypt(config.twilio_auth_token) : defaults.twilio_auth_token,
      twilio_phone_number: config.twilio_phone_number || defaults.twilio_phone_number,
    };
  }

  return defaults;
}

/**
 * Saves a base64 string image to the local public/uploads directory.
 * Returns the absolute public URL.
 */
function saveBase64Image(base64Data: string): string {
  const match = base64Data.match(/^data:([^;]+);base64,/);
  if (!match) {
    throw new Error('Invalid base64 image data');
  }
  const mimetype = match[1];
  const ext = mimetype.split('/')[1] || 'jpeg';
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const filename = `media-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  
  const host = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${host}/uploads/${filename}`;
}

export async function sendWhatsApp(number: string, text: string, tenantId?: string) {
  const config = await getWhatsAppConfig(tenantId);

  const accountSid = config.twilio_account_sid;
  const authToken = config.twilio_auth_token;
  const fromNumber = config.twilio_phone_number;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio: Missing configuration (Account SID, Auth Token, or Phone Number). Skipping message.');
    return null;
  }

  const cleanNumber = number.replace(/\D/g, '');
  let formattedTo = cleanNumber;
  let formattedFrom = fromNumber;

  if (!formattedFrom.startsWith('whatsapp:')) {
    formattedFrom = formattedFrom.startsWith('+') ? `whatsapp:${formattedFrom}` : `whatsapp:+${formattedFrom}`;
  }
  if (!formattedTo.startsWith('whatsapp:')) {
    formattedTo = `whatsapp:+${formattedTo}`;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('From', formattedFrom);
    params.append('Body', text);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Twilio Send Error:', result);
      return null;
    }
    console.log(`Twilio Message Sent to ${formattedTo} [SID: ${result.sid}]`);
    return result;
  } catch (error) {
    console.error('Twilio Send Exception:', error);
    return null;
  }
}

export async function sendWhatsAppMedia(number: string, media: string, caption?: string, tenantId?: string) {
  const config = await getWhatsAppConfig(tenantId);

  const accountSid = config.twilio_account_sid;
  const authToken = config.twilio_auth_token;
  const fromNumber = config.twilio_phone_number;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio: Missing configuration for media. Skipping.');
    return null;
  }

  const cleanNumber = number.replace(/\D/g, '');
  let formattedTo = cleanNumber;
  let formattedFrom = fromNumber;

  if (!formattedFrom.startsWith('whatsapp:')) {
    formattedFrom = formattedFrom.startsWith('+') ? `whatsapp:${formattedFrom}` : `whatsapp:+${formattedFrom}`;
  }
  if (!formattedTo.startsWith('whatsapp:')) {
    formattedTo = `whatsapp:+${formattedTo}`;
  }

  let mediaUrl = media;
  if (media.startsWith('data:')) {
    try {
      mediaUrl = saveBase64Image(media);
    } catch (e) {
      console.error('Failed to save base64 image:', e);
      return null;
    }
  } else if (media.startsWith('/')) {
    const host = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    mediaUrl = `${host}${media}`;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('From', formattedFrom);
    params.append('Body', caption || '');
    params.append('MediaUrl', mediaUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Twilio Send Media Error:', result);
      return null;
    }
    console.log(`Twilio Media Sent to ${formattedTo} [SID: ${result.sid}]`);
    return result;
  } catch (error) {
    console.error('Twilio Send Media Exception:', error);
    return null;
  }
}
