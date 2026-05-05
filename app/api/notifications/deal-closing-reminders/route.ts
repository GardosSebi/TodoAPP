import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createDealClosingReminderEmail } from '@/lib/email'
import {
  getEmailNotificationSettings,
  shouldDeferEmailForQuietHours,
} from '@/lib/emailNotificationSettings'

/** Run daily (or hourly); notifies workspace users when deal.expected_close is within their dealClosingDaysBefore. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const deals = await prisma.deal.findMany({
      where: {
        stage: { notIn: ['WON', 'LOST'] },
        expected_close: { not: null, gte: now, lte: horizon },
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        expected_close: true,
      },
    })

    let emailsSent = 0
    const oneDayAgo = new Date(now)
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    for (const deal of deals) {
      if (!deal.expected_close) continue
      const ms = deal.expected_close.getTime() - now.getTime()
      const daysUntil = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))

      const members = await prisma.workspace.findUnique({
        where: { id: deal.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      })
      if (!members) continue
      const users: { id: string; name: string; email: string }[] = []
      if (members.user?.email) users.push(members.user)
      for (const m of members.members) {
        if (m.user?.email) users.push(m.user)
      }
      const seen = new Set<string>()
      const unique = users.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))

      const closeLabel = deal.expected_close.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const dealLink = `/app/crm/deals/${deal.id}`

      for (const u of unique) {
        if (!u.email?.trim()) continue
        const settings = await getEmailNotificationSettings(u.id)
        if (!settings.dealClosingReminderEmail) continue
        if (daysUntil > settings.dealClosingDaysBefore) continue
        if (shouldDeferEmailForQuietHours(settings)) continue

        const dup = await prisma.notification.findFirst({
          where: {
            userId: u.id,
            type: 'DEAL_CLOSING_SOON',
            link: { contains: deal.id },
            created_at: { gte: oneDayAgo },
          },
        })
        if (dup) continue

        await prisma.notification.create({
          data: {
            userId: u.id,
            type: 'DEAL_CLOSING_SOON',
            title: `Oportunitate: ${deal.title}`,
            message: `Închidere estimată în ${daysUntil} zile (${closeLabel}).`,
            link: dealLink,
          },
        })

        const mail = createDealClosingReminderEmail(
          u.name || u.email,
          deal.title,
          daysUntil,
          closeLabel,
          dealLink
        )
        mail.to = u.email.trim()
        if (await sendEmail(mail)) emailsSent++
      }
    }

    return NextResponse.json({ success: true, dealsChecked: deals.length, emailsSent })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
