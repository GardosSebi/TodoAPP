import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createDailyCrmDigestEmail } from '@/lib/email'
import {
  findDailyDigestEmailPrefs,
  getEmailNotificationSettings,
  isSameUtcCalendarDay,
  shouldDeferEmailForQuietHours,
  updateLastDailyDigestSentAt,
} from '@/lib/emailNotificationSettings'
import { resolveResponsibleUser } from '@/lib/taskResponsibleUser'

function startEndToday(): { start: Date; end: Date } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function workspaceIdsForUser(userId: string): Promise<string[]> {
  const w = await prisma.workspace.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
  return w.map((x) => x.id)
}

function taskBelongsToUser(
  task: {
    userId: string
    responsible: string | null
    workspace: Parameters<typeof resolveResponsibleUser>[1]
  },
  userId: string
): boolean {
  if (task.userId === userId) return true
  const r = resolveResponsibleUser(task.responsible, task.workspace)
  return r?.id === userId
}

/** Run hourly via cron; sends at most once per UTC day per user when digestHourUtc matches. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hourUtc = new Date().getUTCHours()
    const prefsRows = await findDailyDigestEmailPrefs(hourUtc)

    let digestsSent = 0
    const now = new Date()
    const { start, end } = startEndToday()

    for (const pref of prefsRows) {
      if (pref.lastDailyDigestSentAt && isSameUtcCalendarDay(pref.lastDailyDigestSentAt, now)) {
        continue
      }

      const userId = pref.userId
      const workspaceIds = await workspaceIdsForUser(userId)
      if (workspaceIds.length === 0) continue

      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          status: { not: 'COMPLETED' },
          OR: [{ due_at: { lt: start } }, { due_at: { gte: start, lte: end } }],
        },
        include: {
          workspace: {
            include: {
              members: { include: { user: { select: { id: true, name: true, email: true } } } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
          project: { select: { name: true } },
        },
      })

      const mine = tasks.filter((t) => taskBelongsToUser(t, userId))
      const overdue = mine.filter((t) => t.due_at && new Date(t.due_at) < start)
      const dueToday = mine.filter((t) => t.due_at && new Date(t.due_at) >= start && new Date(t.due_at) <= end)
      const overdueIds = new Set(overdue.map((t) => t.id))
      const dueTodayIds = new Set(dueToday.map((t) => t.id))
      const followUps = mine.filter(
        (t) =>
          (t.task_type === 'FOLLOW_UP' || (t.reminder_at && new Date(t.reminder_at) <= end)) &&
          !overdueIds.has(t.id) &&
          !dueTodayIds.has(t.id)
      )
      const topPriority = [...mine]
        .sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority
          const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER
          const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER
          return aDue - bDue
        })
        .slice(0, 3)

      const lines: { label: string; items: string[] }[] = [
        {
          label: 'Top priorități',
          items: topPriority.map(
            (t) => `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}${t.priority > 0 ? ` (P${t.priority})` : ''}`
          ),
        },
        {
          label: 'Sarcini depășite',
          items: overdue.map((t) => `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`),
        },
        {
          label: 'Sarcini cu termen astăzi',
          items: dueToday.map((t) => `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`),
        },
        {
          label: 'Follow-up-uri de reținut',
          items: followUps.map((t) => `${t.title}${t.project?.name ? ` — ${t.project.name}` : ''}`),
        },
      ]

      const full = await getEmailNotificationSettings(userId)
      if (!full.dailyDigestEmail) continue
      if (shouldDeferEmailForQuietHours(full)) continue
      if (!pref.user.email) continue

      const email = createDailyCrmDigestEmail(pref.user.name || pref.user.email, lines)
      email.to = pref.user.email
      const ok = await sendEmail(email)
      if (ok) {
        await updateLastDailyDigestSentAt(userId, now)
        digestsSent++
      }
    }

    return NextResponse.json({ success: true, digestsSent, checkedUsers: prefsRows.length })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
