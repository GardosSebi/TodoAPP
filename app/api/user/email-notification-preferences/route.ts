import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import {
  getEmailNotificationSettings,
  upsertEmailNotificationPreferences,
} from '@/lib/emailNotificationSettings'

const patchSchema = z
  .object({
    upcomingTaskEmail: z.boolean().optional(),
    upcomingHoursBefore: z.number().int().min(1).max(168).optional(),
    overdueTaskEmail: z.boolean().optional(),
    dailyDigestEmail: z.boolean().optional(),
    digestHourUtc: z.number().int().min(0).max(23).optional(),
    followUpReminderEmail: z.boolean().optional(),
    inactiveContactEmail: z.boolean().optional(),
    inactiveContactDays: z.number().int().min(7).max(365).optional(),
    newContactEmail: z.boolean().optional(),
    contactStatusChangeEmail: z.boolean().optional(),
    dealStageChangeEmail: z.boolean().optional(),
    dealClosingReminderEmail: z.boolean().optional(),
    dealClosingDaysBefore: z.number().int().min(0).max(30).optional(),
    dealWonLostEmail: z.boolean().optional(),
    crmNoteAddedEmail: z.boolean().optional(),
    taskCompletedEmail: z.boolean().optional(),
    quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
    quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  })
  .strict()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const row = await getEmailNotificationSettings(session.user.id)

  return NextResponse.json({ settings: row })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = patchSchema.parse(await request.json())
    const row = await upsertEmailNotificationPreferences(session.user.id, { ...body })
    return NextResponse.json({ settings: row })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
