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
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all', 'tasks', 'projects'

    if (!query.trim()) {
      return NextResponse.json({ tasks: [], projects: [] })
    }

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
      return NextResponse.json({ tasks: [], projects: [] })
    }

    const results: { tasks: any[]; projects: any[] } = {
      tasks: [],
      projects: [],
    }

    // Search tasks
    if (type === 'all' || type === 'tasks') {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        take: 50,
        orderBy: [
          { priority: 'desc' },
          { due_at: 'asc' },
        ],
      })

      results.tasks = tasks.map((task: any) => ({
        ...task,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
      }))
    }

    // Search projects
    if (type === 'all' || type === 'projects') {
      const projects = await prisma.project.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { userId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
          name: { contains: query, mode: 'insensitive' },
        },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        take: 20,
        orderBy: { name: 'asc' },
      })

      results.projects = projects.map((project: any) => ({
        ...project,
        created_at: project.created_at.toISOString(),
        updated_at: project.updated_at.toISOString(),
        taskCount: project._count.tasks,
      }))
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

