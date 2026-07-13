import { createHmac } from 'crypto';
import { prisma } from './prisma';

// ─── Event Types ──────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.cancelled'
  | 'client.created'
  | 'client.updated'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.paid'
  | 'boarding.created'
  | 'boarding.checked_in'
  | 'boarding.checked_out'
  | 'campaign.completed'
  | 'webhook.test';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

// ─── HMAC Signing ─────────────────────────────────────────────────────────────

function signPayload(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// ─── Single Delivery ──────────────────────────────────────────────────────────

async function deliverToEndpoint(
  endpointId: string,
  url: string,
  secret: string | null,
  event: WebhookEvent,
  payload: WebhookPayload
) {
  const body = JSON.stringify(payload);
  const start = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PetFlow-Event': event,
    'X-PetFlow-Timestamp': String(Math.floor(Date.now() / 1000)),
    'User-Agent': 'PetFlow-Webhooks/1.0',
  };

  if (secret) {
    headers['X-PetFlow-Signature'] = signPayload(body, secret);
  }

  let status_code: number | null = null;
  let success = false;
  let response: string | null = null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    status_code = res.status;
    success = res.ok;

    const text = await res.text().catch(() => '');
    response = text.slice(0, 500); // store max 500 chars
  } catch (err: any) {
    response = err?.message?.slice(0, 500) ?? 'Unknown error';
    success = false;
  }

  const duration_ms = Date.now() - start;

  // Log the delivery (fire and forget — don't await in the caller)
  await prisma.webhookLog.create({
    data: {
      endpoint_id: endpointId,
      event,
      status_code,
      success,
      payload: payload as any,
      response,
      duration_ms,
    },
  }).catch((e) => console.error('[Webhook] Failed to save log:', e));

  return { success, status_code, duration_ms };
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

/**
 * Fire webhooks for a given event + tenant.
 * Non-blocking — call without await from your actions.
 */
export function fireWebhook(
  event: WebhookEvent,
  tenantId: string,
  data: Record<string, any>
) {
  // Run async in background — never await this
  (async () => {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          tenantId,
          is_active: true,
          events: { has: event },
        },
      });

      if (endpoints.length === 0) return;

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Deliver to all endpoints concurrently
      await Promise.allSettled(
        endpoints.map((ep) =>
          deliverToEndpoint(ep.id, ep.url, ep.secret, event, payload)
        )
      );
    } catch (err) {
      console.error('[Webhook Dispatcher] Error:', err);
    }
  })();
}

/**
 * Deliver a test ping to a single endpoint URL.
 * Returns result synchronously (used by the Test button in UI).
 */
export async function testWebhookEndpoint(
  endpointId: string,
  url: string,
  secret: string | null
) {
  const payload: WebhookPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test ping from PetFlow CRM 🐾',
      description: 'If you received this, your webhook is connected correctly!',
    },
  };
  return deliverToEndpoint(endpointId, url, secret, 'webhook.test', payload);
}
