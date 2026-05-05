import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createCrmFollowUpReminderEmail } from '@/lib/email'
import { getEmailNotificationSettings, shouldDeferEmailForQuietHours } from '@/lib/emailNotificationSettings'
import { resolveResponsibleUser } from '@/lib/taskResponsibleUser'
import { followUpSuggestedActionFromTaskType } from '@/lib/crmFormat'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const tasks = await prisma.task.findMany({
      where: {
        archived: false,
        status: { not: 'COMPLETED' },
        OR: [
          { reminder_at: { lte: now } },
          { task_type: 'FOLLOW_UP', due_at: { lte: in48h, gte: now } },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
        project: { select: { id: true, name: true } },
        contact: { select: { first_name: true, last_name: true, id: true } },
        company: { select: { name: true } },
      },
    })

    let emailsSent = 0
    let skipped = 0

    for (const task of tasks) {
      const u = resolveResponsibleUser(task.responsible, task.workspace) ?? task.user
      if (!u?.email) continue

      const settings = await getEmailNotificationSettings(u.id)
      if (!settings.followUpReminderEmail) {
        skipped++
        continue
      }

      const oneDayAgo = new Date(now)
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      const dup = await prisma.notification.findFirst({
        where: {
          userId: u.id,
          type: 'CRM_FOLLOWUP_REMINDER',
          link: { contains: task.id },
          created_at: { gte: oneDayAgo },
        },
      })
      if (dup) continue

      const taskLink = task.projectId
        ? `/app/project/${task.projectId}?task=${task.id}`
        : `/app?task=${task.id}`

      let lastIx: string | null = null
      if (task.contactId) {
        const ix = await prisma.interaction.findFirst({
          where: { contactId: task.contactId },
          orderBy: { happened_at: 'desc' },
          select: { type: true, happened_at: true, subject: true },
        })
        if (ix) {
          lastIx = `${ix.type} — ${ix.happened_at.toLocaleDateString('ro-RO')}${ix.subject ? ` (${ix.subject})` : ''}`
        }
      }

      const contactHint = task.contact
        ? `${task.contact.first_name} ${task.contact.last_name}${task.company?.name ? ` (${task.company.name})` : ''}`
        : null

      await prisma.notification.create({
        data: {
          userId: u.id,
          type: 'CRM_FOLLOWUP_REMINDER',
          title: `Follow-up: ${task.title}`,
          message: contactHint || 'Verifică sarcina în CRM.',
          link: taskLink,
        },
      })

      if (!shouldDeferEmailForQuietHours(settings)) {
        const suggested = followUpSuggestedActionFromTaskType(task.task_type)
        const email = createCrmFollowUpReminderEmail(
          u.name || u.email,
          task.title,
          taskLink,
          contactHint,
          lastIx,
          suggested
        )
        email.to = u.email
        if (await sendEmail(email)) emailsSent++
      }
    }

    return NextResponse.json({ success: true, tasksChecked: tasks.length, emailsSent, skipped })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
