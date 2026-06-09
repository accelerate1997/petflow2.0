import { prisma } from './prisma';
import { getCurrentTenantId } from './session-utils';
import { decrypt } from './encryption';

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
  };

  if (config) {
    return {
      evolution_api_url: config.evolution_api_url || defaults.evolution_api_url,
      evolution_api_key: decrypt(config.evolution_api_key) || defaults.evolution_api_key,
      instance_name: config.instance_name || defaults.instance_name,
    };
  }

  return defaults;
}

/**
 * Formats a phone number for Evolution API:
 * - Strips non-digits
 * - Removes leading zero
 * - Auto-prefixes 10-digit Indian numbers with "91"
 */
function formatPhoneNumber(number: string): string {
  let formatted = number.replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = formatted.substring(1);
  }
  if (formatted.length === 10) {
    formatted = '91' + formatted;
  }
  return formatted;
}

export async function sendWhatsApp(number: string, text: string, tenantId?: string) {
  const config = await getWhatsAppConfig(tenantId);

  const baseUrl = config.evolution_api_url;
  const apiKey = config.evolution_api_key;
  const instance = config.instance_name;

  if (!baseUrl || !apiKey || !instance) {
    console.warn('WhatsApp: Missing configuration (URL, API Key, or Instance). Skipping message.');
    return null;
  }

  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${cleanUrl}/message/sendText/${instance}`;
  const formattedNumber = formatPhoneNumber(number);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: formattedNumber,
        text,
        delay: 1200,
        linkPreview: false
      })
    });

    const result = await response.json();
    console.log(`WhatsApp [${instance}] → ${formattedNumber}:`, result?.key?.id || result);
    return result;
  } catch (error) {
    console.error('WhatsApp Error:', error);
    return null;
  }
}

export async function sendWhatsAppMedia(number: string, media: string, caption?: string, tenantId?: string) {
  const config = await getWhatsAppConfig(tenantId);

  const baseUrl = config.evolution_api_url;
  const apiKey = config.evolution_api_key;
  const instance = config.instance_name;

  if (!baseUrl || !apiKey || !instance) {
    console.warn('WhatsApp: Missing configuration (URL, API Key, or Instance). Skipping media message.');
    return null;
  }

  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${cleanUrl}/message/sendMedia/${instance}`;
  const formattedNumber = formatPhoneNumber(number);

  try {
    const payload: any = {
      number: formattedNumber,
      mediatype: 'image',
      media: media,
      caption: caption || '',
      delay: 1200
    };

    if (media.startsWith('data:')) {
      const match = media.match(/^data:([^;]+);base64,/);
      if (match) {
        payload.mimetype = match[1];
        const ext = payload.mimetype.split('/')[1] || 'jpeg';
        payload.fileName = `image.${ext}`;
        // Strip data URI prefix for Evolution API
        payload.media = media.replace(/^data:[^;]+;base64,/, '');
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`WhatsApp Media [${instance}] → ${formattedNumber}:`, result?.key?.id || result);
    return result;
  } catch (error) {
    console.error('WhatsApp Media Error:', error);
    return null;
  }
}
