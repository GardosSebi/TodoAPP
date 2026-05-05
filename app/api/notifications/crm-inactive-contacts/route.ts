import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createInactiveContactsEmail } from '@/lib/email'
import {
  findInactiveContactEmailPrefs,
  getEmailNotificationSettings,
  shouldDeferEmailForQuietHours,
  updateLastInactiveContactsSentAt,
} from '@/lib/emailNotificationSettings'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function lastContactActivity(contactId: string): Promise<Date> {
  const [task, note, ix] = await Promise.all([
    prisma.task.findFirst({
      where: { contactId },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    }),
    prisma.cRMNote.findFirst({
      where: { contactId },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    }),
    prisma.interaction.findFirst({
      where: { contactId },
      orderBy: { happened_at: 'desc' },
      select: { happened_at: true },
    }),
  ])
  const dates = [task?.updated_at, note?.updated_at, ix?.happened_at].filter(Boolean) as Date[]
  if (dates.length === 0) return new Date(0)
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

/** At most one email per user per 7 days. Run weekly via cron. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const prefs = await findInactiveContactEmailPrefs()

    let emailsSent = 0

    for (const pref of prefs) {
      if (
        pref.lastInactiveContactsSentAt &&
        now.getTime() - pref.lastInactiveContactsSentAt.getTime() < WEEK_MS
      ) {
        continue
      }

      const userId = pref.userId
      const settings = await getEmailNotificationSettings(userId)
      if (!settings.inactiveContactEmail) continue
      if (shouldDeferEmailForQuietHours(settings)) continue
      if (!pref.user.email) continue

      const contacts = await prisma.contact.findMany({
        where: {
          OR: [{ created_by: userId }, { assigned_to: userId }],
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          workspaceId: true,
          updated_at: true,
        },
      })

      const stale: {
        name: string
        daysSince: number
        link: string
        lastActivityLabel?: string | null
      }[] = []
      const thresholdDays = settings.inactiveContactDays

      for (const c of contacts) {
        const last = await lastContactActivity(c.id)
        const effective = new Date(Math.max(last.getTime(), c.updated_at.getTime()))
        const daysSince = Math.floor((now.getTime() - effective.getTime()) / (86400 * 1000))
        if (daysSince >= thresholdDays) {
          stale.push({
            name: `${c.first_name} ${c.last_name}`.trim(),
            daysSince,
            link: `/app/crm/contacts/${c.id}`,
            lastActivityLabel:
              effective.getTime() > 0
                ? effective.toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—',
          })
        }
      }

      if (stale.length === 0) continue

      const email = createInactiveContactsEmail(pref.user.name || pref.user.email, stale.slice(0, 20))
      email.to = pref.user.email
      if (await sendEmail(email)) {
        await updateLastInactiveContactsSentAt(userId, now)
        emailsSent++
      }
    }

    return NextResponse.json({ success: true, emailsSent, usersChecked: prefs.length })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
