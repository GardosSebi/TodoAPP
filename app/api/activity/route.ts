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
    const workspaceId = searchParams.get('workspaceId')
    const taskId = searchParams.get('taskId')
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '50')

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
      return NextResponse.json({ activities: [] })
    }

    const where: any = {
      workspaceId: { in: workspaceIds },
    }

    if (workspaceId && workspaceIds.includes(workspaceId)) {
      where.workspaceId = workspaceId
    }

    if (taskId) {
      where.taskId = taskId
    }

    if (projectId) {
      where.projectId = projectId
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    const formattedActivities = activities.map((activity: any) => ({
      ...activity,
      created_at: activity.created_at.toISOString(),
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }))

    return NextResponse.json({ activities: formattedActivities })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

