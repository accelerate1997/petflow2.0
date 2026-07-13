'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentTenantId } from './session-utils'
import {
  type PetroConfigData,
  DEFAULT_BOOKING_RULES
} from './petro-config-types'

export async function getPetroConfig(): Promise<PetroConfigData | null> {
  try {
    const tenantId = await getCurrentTenantId()
    const config = await prisma.petroConfig.findFirst({
      where: { is_active: true, tenantId },
      orderBy: { created: 'desc' },
    })

    if (!config) return null

    return {
      id: config.id,
      tenantId: config.tenantId || undefined,
      agent_name: config.agent_name,
      persona: config.persona,
      tone: config.tone,
      language: config.language,
      booking_rules: (config.booking_rules as any) || DEFAULT_BOOKING_RULES,
      tools_enabled: config.tools_enabled,
      knowledge_base: (config.knowledge_base as any) || [],
      plan_tier: config.plan_tier,
      is_active: config.is_active,
    }
  } catch (error) {
    console.error('getPetroConfig error:', error)
    return null
  }
}

export async function savePetroConfig(data: PetroConfigData): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantId = await getCurrentTenantId()
    const existing = await prisma.petroConfig.findFirst({
      where: { is_active: true, tenantId },
      orderBy: { created: 'desc' },
    })

    const saveData = {
      tenantId,
      agent_name: data.agent_name,
      persona: data.persona,
      tone: data.tone,
      language: data.language,
      booking_rules: data.booking_rules as any,
      tools_enabled: data.tools_enabled,
      knowledge_base: data.knowledge_base as any,
      plan_tier: data.plan_tier,
      is_active: true,
    }

    if (existing) {
      await prisma.petroConfig.update({ where: { id: existing.id }, data: saveData })
    } else {
      await prisma.petroConfig.create({ data: saveData })
    }

    revalidatePath('/petro')
    revalidatePath('/settings')
    return { success: true }
  } catch (error: any) {
    console.error('savePetroConfig error:', error)
    return { success: false, error: error.message }
  }
}

export async function previewPetroChat(
  config: PetroConfigData,
  messages: { role: string; content: string }[]
): Promise<{ success: boolean; reply?: string; logs?: string[]; error?: string }> {
  try {
    const tenantId = await getCurrentTenantId()
    const configWithTenant = {
      ...config,
      tenantId,
    }
    const res = await fetch('http://127.0.0.1:3002/api/petro-config/chat-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config: configWithTenant, messages }),
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Agent server responded with status: ${res.status}`);
    }

    const data = await res.json();
    if (data.success) {
      return { success: true, reply: data.reply, logs: data.logs };
    } else {
      return { success: false, error: data.error || 'Failed to generate preview chat response.' };
    }
  } catch (error: any) {
    console.error('previewPetroChat error details:', error);
    if (error.cause) {
      console.error('previewPetroChat error cause:', error.cause);
    }
    return { success: false, error: `${error.message}${error.cause ? ' - ' + error.cause.message : ''}` || 'Failed to connect to agent server.' };
  }
}
