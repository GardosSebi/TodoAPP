import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week' // 'week' or 'month'

    // Get workspaces where user is owner or member
    const userWorkspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    })

    const workspaceIds = userWorkspaces.map((w) => w.id)

    if (workspaceIds.length === 0) {
      return NextResponse.json({
        projectProgress: [],
        completedTasksByPeriod: [],
        productivityByDay: [],
      })
    }

    // Get accessible project IDs
    const accessibleProjects = await prisma.project.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true, name: true, color: true },
    })

    const accessibleProjectIds = accessibleProjects.map((p) => p.id)

    // 1. Project Progress Statistics
    const projectProgress = await Promise.all(
      accessibleProjects.map(async (project) => {
        const totalTasks = await prisma.task.count({
          where: {
            projectId: project.id,
            workspaceId: { in: workspaceIds },
            archived: false,
          },
        })

        const completedTasks = await prisma.task.count({
          where: {
            projectId: project.id,
            workspaceId: { in: workspaceIds },
            archived: false,
            status: 'COMPLETED',
          },
        })

        const activeTasks = await prisma.task.count({
          where: {
            projectId: project.id,
            workspaceId: { in: workspaceIds },
            archived: false,
            status: {
              in: ['ACTIVE', 'NOT_STARTED', 'IN_PROGRESS'],
            },
          },
        })

        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        return {
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          totalTasks,
          completedTasks,
          activeTasks,
          progress,
        }
      })
    )

    // 2. Completed Tasks by Period
    const now = new Date()
    let startDate: Date

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      // Week - last 7 days
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
    }

    const completedTasksByPeriod = await prisma.task.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        status: 'COMPLETED',
        completed_at: {
          gte: startDate,
        },
      },
      select: {
        completed_at: true,
      },
      orderBy: {
        completed_at: 'asc',
      },
    })

    // Group by day
    const tasksByDay: Record<string, number> = {}
    completedTasksByPeriod.forEach((task) => {
      if (task.completed_at) {
        const date = new Date(task.completed_at)
        const dateKey = date.toISOString().split('T')[0]
        tasksByDay[dateKey] = (tasksByDay[dateKey] || 0) + 1
      }
    })

    // Fill in missing days with 0
    const completedTasksByPeriodFormatted = []
    const currentDate = new Date(startDate)
    const endDate = new Date(now)

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      completedTasksByPeriodFormatted.push({
        date: dateKey,
        count: tasksByDay[dateKey] || 0,
        dayName: currentDate.toLocaleDateString('ro-RO', { weekday: 'short' }),
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // 3. Productivity by Day (last 7 days)
    const productivityStartDate = new Date(now)
    productivityStartDate.setDate(productivityStartDate.getDate() - 6)
    productivityStartDate.setHours(0, 0, 0, 0)

    const productivityByDay = []
    const currentProdDate = new Date(productivityStartDate)

    while (currentProdDate <= now) {
      const dayStart = new Date(currentProdDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(currentProdDate)
      dayEnd.setHours(23, 59, 59, 999)

      const tasksCompleted = await prisma.task.count({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          status: 'COMPLETED',
          completed_at: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      })

      const tasksCreated = await prisma.task.count({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          created_at: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      })

      productivityByDay.push({
        date: currentProdDate.toISOString().split('T')[0],
        dayName: currentProdDate.toLocaleDateString('ro-RO', { weekday: 'short' }),
        completed: tasksCompleted,
        created: tasksCreated,
        productivity: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
      })

      currentProdDate.setDate(currentProdDate.getDate() + 1)
    }

    // 4. Overall Statistics
    const totalTasks = await prisma.task.count({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
      },
    })

    const activeTasks = await prisma.task.count({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        status: {
          in: ['ACTIVE', 'NOT_STARTED', 'IN_PROGRESS'],
        },
      },
    })

    const completedTasksTotal = await prisma.task.count({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        status: 'COMPLETED',
      },
    })

    const completionRate = totalTasks > 0 ? Math.round((completedTasksTotal / totalTasks) * 100) : 0

    // 5. CRM Statistics
    const totalContacts = await (prisma as any).contact.count({
      where: { workspaceId: { in: workspaceIds } },
    })
    const totalCompanies = await (prisma as any).company.count({
      where: { workspaceId: { in: workspaceIds } },
    })
    const totalDeals = await (prisma as any).deal.count({
      where: { workspaceId: { in: workspaceIds } },
    })
    const activeDeals = await (prisma as any).deal.count({
      where: {
        workspaceId: { in: workspaceIds },
        stage: { in: ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'] },
      },
    })
    const wonDeals = await (prisma as any).deal.count({
      where: { workspaceId: { in: workspaceIds }, stage: 'WON' },
    })
    const conversionRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const overdueFollowUps = await prisma.task.count({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        status: { in: ['ACTIVE', 'NOT_STARTED', 'IN_PROGRESS'] },
        reminder_at: { lt: today },
      },
    })
    const upcomingFollowUps = await prisma.task.count({
      where: {
        workspaceId: { in: workspaceIds },
        archived: false,
        status: { in: ['ACTIVE', 'NOT_STARTED', 'IN_PROGRESS'] },
        reminder_at: { gte: today, lt: tomorrow },
      },
    })

    const dealsByStageRaw = await (prisma as any).deal.groupBy({
      by: ['stage'],
      where: { workspaceId: { in: workspaceIds } },
      _count: { stage: true },
      _sum: { value: true },
    })
    const dealsByStage = dealsByStageRaw.map((item: any) => ({
      stage: item.stage,
      count: item._count.stage || 0,
      value: item._sum.value || 0,
    }))
    const pipelineTotalValue = dealsByStage.reduce((acc: number, item: any) => acc + (item.value || 0), 0)

    return NextResponse.json({
      projectProgress,
      completedTasksByPeriod: completedTasksByPeriodFormatted,
      productivityByDay,
      overallStats: {
        totalTasks,
        activeTasks,
        completedTasks: completedTasksTotal,
        completionRate,
        totalProjects: accessibleProjects.length,
      },
      crmStats: {
        totalContacts,
        totalCompanies,
        activeDeals,
        overdueFollowUps,
        upcomingFollowUps,
        dealsByStage,
        pipelineTotalValue,
        conversionRate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

