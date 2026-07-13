import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/cron/data-retention
 * 
 * Automated data retention cron job — run weekly via Vercel Cron or external scheduler.
 * 
 * What it does:
 * 1. Deletes ChatMessage records older than 90 days (configurable via CHAT_RETENTION_DAYS env)
 * 2. Anonymizes CampaignLog phone/name after 12 months
 * 3. Sets retention_expires_at on new ChatSessions (90 days from last activity)
 * 4. Logs all purge activity to AuditLog
 * 
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const CHAT_RETENTION_DAYS = parseInt(process.env.CHAT_RETENTION_DAYS || '90')
  const CAMPAIGN_LOG_RETENTION_DAYS = parseInt(process.env.CAMPAIGN_LOG_RETENTION_DAYS || '365')

  const chatCutoff = new Date()
  chatCutoff.setDate(chatCutoff.getDate() - CHAT_RETENTION_DAYS)

  const campaignCutoff = new Date()
  campaignCutoff.setDate(campaignCutoff.getDate() - CAMPAIGN_LOG_RETENTION_DAYS)

  const results = {
    chatSessions: { purged: 0, sessionsUpdated: 0 },
    campaignLogs: { anonymized: 0 },
    errors: [] as string[]
  }

  try {
    // ─── 1. Set retention_expires_at on ChatSessions that don't have one ─────
    const sessionsWithoutExpiry = await prisma.chatSession.findMany({
      where: { retention_expires_at: null },
      select: { id: true, updated: true }
    })

    for (const session of sessionsWithoutExpiry) {
      const expires = new Date(session.updated)
      expires.setDate(expires.getDate() + CHAT_RETENTION_DAYS)
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { retention_expires_at: expires }
      })
      results.chatSessions.sessionsUpdated++
    }

    // ─── 2. Delete ChatMessages from expired sessions ─────────────────────────
    const expiredSessions = await prisma.chatSession.findMany({
      where: {
        OR: [
          { retention_expires_at: { lt: new Date() } },
          { updated: { lt: chatCutoff } }
        ]
      },
      select: { id: true }
    })

    for (const session of expiredSessions) {
      const deleted = await prisma.chatMessage.deleteMany({
        where: { session_id: session.id }
      })
      results.chatSessions.purged += deleted.count
    }

    // ─── 3. Anonymize old CampaignLog PII ────────────────────────────────────
    // We can't use updateMany with expressions, so we find and update in batches
    const oldLogs = await prisma.campaignLog.findMany({
      where: {
        sentAt: { lt: campaignCutoff },
        NOT: { phone: '[Anonymized]' }
      },
      select: { id: true }
    })

    for (const log of oldLogs) {
      await prisma.campaignLog.update({
        where: { id: log.id },
        data: { clientName: '[Anonymized]', phone: '[Anonymized]' }
      })
      results.campaignLogs.anonymized++
    }

    // ─── 4. Log the purge action to AuditLog ─────────────────────────────────
    await prisma.auditLog.create({
      data: {
        action: 'cron.data_retention',
        entity_type: 'System',
        metadata: {
          chat_messages_purged: results.chatSessions.purged,
          campaign_logs_anonymized: results.campaignLogs.anonymized,
          chat_retention_days: CHAT_RETENTION_DAYS,
          campaign_retention_days: CAMPAIGN_LOG_RETENTION_DAYS,
          ran_at: new Date().toISOString()
        }
      }
    })

    console.log('[Data Retention Cron] Completed:', results)
    return NextResponse.json({ success: true, ...results })

  } catch (error: any) {
    console.error('[Data Retention Cron] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
