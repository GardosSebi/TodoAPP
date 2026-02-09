import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, createTaskDueSoonEmail } from '@/lib/email'

// This endpoint checks for tasks due within 7 days and sends notifications to responsible users
// Should be called periodically (e.g., via cron job or scheduled task)
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check for cron job
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    sevenDaysFromNow.setHours(23, 59, 59, 999)

    // Find all tasks with due_at within the next 7 days
    // Exclude completed tasks
    const tasks = await prisma.task.findMany({
      where: {
        due_at: {
          gte: now,
          lte: sevenDaysFromNow,
        },
        status: {
          not: 'COMPLETED',
        },
        responsible: {
          not: null,
        },
      },
      include: {
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
      },
    })

    let notificationsCreated = 0
    let emailsSent = 0

    for (const task of tasks) {
      if (!task.responsible) continue

      // Find the responsible user by name in workspace members or owner
      const responsibleUser =
        task.workspace.members.find((m) => m.user.name === task.responsible)?.user ||
        (task.workspace.user?.name === task.responsible ? task.workspace.user : null)

      if (!responsibleUser) continue

      // Calculate days remaining
      const dueDate = new Date(task.due_at!)
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Check if notification already exists for this task and user in the last 24 hours
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

      // Skip if notification already sent in last 24 hours
      if (existingNotification) continue

      // Create task link
      const taskLink = task.projectId
        ? `/app/project/${task.projectId}?task=${task.id}`
        : `/app?task=${task.id}`

      // Format due date
      const dueDateFormatted = dueDate.toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      // Create notification
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

      // Send email if user has email
      if (responsibleUser.email) {
        const emailNotification = createTaskDueSoonEmail(
          responsibleUser.name || responsibleUser.email,
          task.title,
          taskLink,
          daysRemaining,
          dueDateFormatted,
          task.project?.name || null
        )
        emailNotification.to = responsibleUser.email
        await sendEmail(emailNotification)
        emailsSent++
      }
    }

    return NextResponse.json({
      success: true,
      tasksChecked: tasks.length,
      notificationsCreated,
      emailsSent,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

