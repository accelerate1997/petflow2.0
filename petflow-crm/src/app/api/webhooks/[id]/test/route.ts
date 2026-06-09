import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/session-utils';
import { testWebhookEndpoint } from '@/lib/webhook-dispatcher';

// ─── POST /api/webhooks/[id]/test — Send test ping ───────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await getCurrentTenantId();

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    }

    const result = await testWebhookEndpoint(endpoint.id, endpoint.url, endpoint.secret);

    return NextResponse.json({
      success: result.success,
      status_code: result.status_code,
      duration_ms: result.duration_ms,
      message: result.success
        ? `✅ Test delivered successfully (${result.status_code})`
        : `❌ Delivery failed (${result.status_code ?? 'no response'})`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
