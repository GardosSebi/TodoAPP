import { prisma } from '@/lib/prisma'

/** Mirrors Prisma `EmailNotificationSettings` (local type avoids stale `@prisma/client` exports). */
export interface EmailNotificationSettingsRow {
  id: string
  userId: string
  upcomingTaskEmail: boolean
  upcomingHoursBefore: number
  overdueTaskEmail: boolean
  dailyDigestEmail: boolean
  digestHourUtc: number
  lastDailyDigestSentAt: Date | null
  followUpReminderEmail: boolean
  inactiveContactEmail: boolean
  inactiveContactDays: number
  lastInactiveContactsSentAt: Date | null
  newContactEmail: boolean
  contactStatusChangeEmail: boolean
  dealStageChangeEmail: boolean
  dealClosingReminderEmail: boolean
  dealClosingDaysBefore: number
  dealWonLostEmail: boolean
  crmNoteAddedEmail: boolean
  taskCompletedEmail: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
  created_at: Date
  updated_at: Date
}

export type EmailNotificationSettingsDTO = EmailNotificationSettingsRow

/** Row shape for cron routes that join `user`. */
export type EmailNotificationSettingsWithUser = EmailNotificationSettingsRow & {
  user: { id: string; email: string; name: string }
}

type EmailNotificationSettingsDelegate = {
  upsert(args: {
    where: { userId: string }
    create: { userId: string } & Record<string, unknown>
    update: Record<string, unknown>
  }): Promise<EmailNotificationSettingsRow>
  findMany(args: {
    where: Record<string, unknown>
    include?: Record<string, unknown>
  }): Promise<unknown[]>
  update(args: {
    where: { userId: string }
    data: Partial<EmailNotificationSettingsRow>
  }): Promise<EmailNotificationSettingsRow>
}

function emailNotificationSettingsDb(): EmailNotificationSettingsDelegate {
  return (prisma as unknown as { emailNotificationSettings: EmailNotificationSettingsDelegate })
    .emailNotificationSettings
}

export async function findInactiveContactEmailPrefs(): Promise<EmailNotificationSettingsWithUser[]> {
  const rows = await emailNotificationSettingsDb().findMany({
    where: { inactiveContactEmail: true },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  return rows as EmailNotificationSettingsWithUser[]
}

export async function findDailyDigestEmailPrefs(
  digestHourUtc: number
): Promise<EmailNotificationSettingsWithUser[]> {
  const rows = await emailNotificationSettingsDb().findMany({
    where: { dailyDigestEmail: true, digestHourUtc },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  return rows as EmailNotificationSettingsWithUser[]
}

export async function updateLastInactiveContactsSentAt(userId: string, at: Date): Promise<void> {
  await emailNotificationSettingsDb().update({
    where: { userId },
    data: { lastInactiveContactsSentAt: at },
  })
}

export async function updateLastDailyDigestSentAt(userId: string, at: Date): Promise<void> {
  await emailNotificationSettingsDb().update({
    where: { userId },
    data: { lastDailyDigestSentAt: at },
  })
}

const MAX_UPCOMING_HOURS_CAP = 168 // 7 days; cron queries up to this horizon

export function getMaxUpcomingHorizonHours(): number {
  return MAX_UPCOMING_HOURS_CAP
}

/** Create defaults on first read. */
export async function getEmailNotificationSettings(
  userId: string
): Promise<EmailNotificationSettingsRow> {
  return emailNotificationSettingsDb().upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

/** PATCH semantics: create row with defaults + patch, or update existing. */
export async function upsertEmailNotificationPreferences(
  userId: string,
  partial: Record<string, unknown>
): Promise<EmailNotificationSettingsRow> {
  return emailNotificationSettingsDb().upsert({
    where: { userId },
    create: { userId, ...partial },
    update: partial,
  })
}

/**
 * Quiet hours use the server's local clock (often UTC on VPS).
 * start/end are 0–23. If both null, quiet hours are disabled.
 * Supports overnight window (e.g. 22 → 8).
 */
export function isInQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined
): boolean {
  if (start == null || end == null) return false
  if (start === end) return false
  if (start < end) {
    return hour >= start && hour < end
  }
  return hour >= start || hour < end
}

export function shouldDeferEmailForQuietHours(
  settings: Pick<EmailNotificationSettingsRow, 'quietHoursStart' | 'quietHoursEnd'>
): boolean {
  const h = new Date().getHours()
  return isInQuietHours(h, settings.quietHoursStart, settings.quietHoursEnd)
}

export function hoursUntilDue(dueAt: Date, from: Date = new Date()): number {
  return (dueAt.getTime() - from.getTime()) / (1000 * 60 * 60)
}

export function isSameUtcCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}
