import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/session-utils';

// ─── GET /api/webhooks — List all endpoints for tenant ────────────────────────
export async function GET() {
  try {
    const tenantId = await getCurrentTenantId();
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { created: 'desc' },
      include: {
        logs: {
          orderBy: { created: 'desc' },
          take: 1,
          select: { success: true, status_code: true, created: true },
        },
      },
    });
    return NextResponse.json({ success: true, endpoints });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST /api/webhooks — Create new endpoint ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const tenantId = await getCurrentTenantId();
    const { name, url, secret, events } = await req.json();

    if (!name || !url) {
      return NextResponse.json({ success: false, error: 'Name and URL are required.' }, { status: 400 });
    }

    // Basic URL validation
    try { new URL(url); } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL format.' }, { status: 400 });
    }

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        name: name.trim(),
        url: url.trim(),
        secret: secret?.trim() || null,
        events: Array.isArray(events) ? events : [],
        is_active: true,
      },
    });

    return NextResponse.json({ success: true, endpoint }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
