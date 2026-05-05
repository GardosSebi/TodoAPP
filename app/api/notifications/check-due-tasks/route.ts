import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createTaskDueSoonEmail } from '@/lib/email'
import {
  getEmailNotificationSettings,
  getMaxUpcomingHorizonHours,
  hoursUntilDue,
  shouldDeferEmailForQuietHours,
} from '@/lib/emailNotificationSettings'
import { formatTaskCrmLine, resolveResponsibleUser } from '@/lib/taskResponsibleUser'

/** Tasks due within the next N hours (cap); respects per-user upcomingHoursBefore + email toggles + quiet hours. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const horizon = new Date(now)
    horizon.setTime(horizon.getTime() + getMaxUpcomingHorizonHours() * 60 * 60 * 1000)

    const tasks = await prisma.task.findMany({
      where: {
        archived: false,
        due_at: {
          gte: now,
          lte: horizon,
        },
        status: {
          not: 'COMPLETED',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        contact: {
          select: { first_name: true, last_name: true },
        },
        company: {
          select: { name: true },
        },
      },
    })

    let notificationsCreated = 0
    let emailsSent = 0
    let skippedByPreference = 0

    for (const task of tasks) {
      if (!task.due_at) continue

      const responsibleUser =
        resolveResponsibleUser(task.responsible, task.workspace) ?? task.user
      if (!responsibleUser?.email) continue

      const settings = await getEmailNotificationSettings(responsibleUser.id)
      if (!settings.upcomingTaskEmail) {
        skippedByPreference++
        continue
      }

      const dueDate = new Date(task.due_at)
      const hUntil = hoursUntilDue(dueDate, now)
      // În fereastra setată în cont (implicit 24h = „cu cel mult 24h înainte de termen”)
      if (hUntil > settings.upcomingHoursBefore) continue

      const daysRemaining = Math.max(1, Math.ceil(hUntil / 24))

      const oneDayAgo = new Date(now)
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: responsibleUser.id,
          type: 'TASK_DUE_SOON',
          link: {
            contains: task.id,
          },
          created_at: {
            gte: oneDayAgo,
          },
        },
      })

      if (existingNotification) continue

      const taskLink = task.projectId
        ? `/app/project/${task.projectId}?task=${task.id}`
        : `/app?task=${task.id}`

      const dueDateFormatted = dueDate.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const crmLine = formatTaskCrmLine(task.contact, task.company)

      await prisma.notification.create({
        data: {
          userId: responsibleUser.id,
          type: 'TASK_DUE_SOON',
          title: `Termen limită: ${task.title}`,
          message: `Mai ai ${daysRemaining} ${daysRemaining === 1 ? 'zi' : 'zile'} până la termen pentru sarcina "${task.title}"${task.project ? ` din proiectul "${task.project.name}"` : ''}.`,
          link: taskLink,
        },
      })
      notificationsCreated++

      if (!shouldDeferEmailForQuietHours(settings)) {
        const emailNotification = createTaskDueSoonEmail(
          responsibleUser.name || responsibleUser.email,
          task.title,
          taskLink,
          daysRemaining,
          dueDateFormatted,
          task.project?.name || null,
          crmLine
        )
        emailNotification.to = responsibleUser.email
        const sent = await sendEmail(emailNotification)
        if (sent) emailsSent++
      }
    }

    return NextResponse.json({
      success: true,
      tasksChecked: tasks.length,
      notificationsCreated,
      emailsSent,
      skippedByPreference,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
