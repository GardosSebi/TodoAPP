import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TodayClient from './TodayClient'

export default async function TodayPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Get first and last day of current month for calendar
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  nextMonth.setHours(23, 59, 59, 999)

  // Fetch tasks for today
  const todayTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: 'ACTIVE',
      due_at: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      files: {
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    } as any,
    orderBy: [
      { priority: 'desc' },
      { due_at: 'asc' },
      { created_at: 'desc' },
    ],
  })

  // Fetch all tasks with due dates (for calendar - show all months)
  const monthTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      due_at: {
        not: null,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          userId: true,
          name: true,
          color: true,
          created_at: true,
          updated_at: true,
        },
      },
      files: {
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    } as any,
    orderBy: [
      { priority: 'desc' },
      { due_at: 'asc' },
      { created_at: 'desc' },
    ],
  })

  return (
    <TodayClient
      initialTasks={todayTasks.map((task: any) => ({
        ...task,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
        files: (task.files || []).map((file: any) => ({
          ...file,
          uploaded_at: file.uploaded_at.toISOString(),
        })),
      }))}
      monthTasks={monthTasks.map((task: any) => ({
        ...task,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
        project: task.project
          ? {
              ...task.project,
              created_at: task.project.created_at.toISOString(),
              updated_at: task.project.updated_at.toISOString(),
            }
          : null,
        files: (task.files || []).map((file: any) => ({
          ...file,
          uploaded_at: file.uploaded_at.toISOString(),
        })),
      }))}
    />
  )
}

