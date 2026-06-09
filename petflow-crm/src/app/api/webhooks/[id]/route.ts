import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/session-utils';

// ─── PATCH /api/webhooks/[id] — Update endpoint ───────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await getCurrentTenantId();
    const data = await req.json();

    // Verify ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.url !== undefined && { url: data.url.trim() }),
        ...(data.secret !== undefined && { secret: data.secret?.trim() || null }),
        ...(data.events !== undefined && { events: data.events }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      },
    });

    return NextResponse.json({ success: true, endpoint: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/webhooks/[id] — Delete endpoint ─────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await getCurrentTenantId();

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    }

    // Cascade deletes logs automatically (onDelete: Cascade in schema)
    await prisma.webhookEndpoint.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
