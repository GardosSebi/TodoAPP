import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true' // Include archived projects

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
      return NextResponse.json({ projects: [] })
    }

    // Get all projects from accessible workspaces
    // Workspace members have access to all projects in that workspace
    const where: any = {
      workspaceId: { in: workspaceIds },
    }

    // Exclude archived projects by default unless explicitly requested
    if (!includeArchived) {
      where.archived = false
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
      orderBy: [
        {
          order: 'asc',
        },
        {
          created_at: 'asc',
        },
      ],
    })

    // Calculate task counts excluding archived tasks
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const taskCount = await prisma.task.count({
          where: {
            projectId: project.id,
            archived: false,
          },
        })
        return {
          ...project,
          _count: {
            tasks: taskCount,
          },
        }
      })
    )

    return NextResponse.json({
      projects: projectsWithCounts.map((project: any) => ({
        ...project,
        completed: project.completed || false,
        order: project.order ?? 0,
        workspace: {
          id: project.workspace.id,
          name: project.workspace.name,
          userId: project.workspace.userId,
        },
      })),
    })
  } catch (error) {
    // Error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = projectSchema.parse(body)

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })

    if (!user?.workspaceId) {
      return NextResponse.json(
        { error: 'User workspace not found' },
        { status: 404 }
      )
    }

    // Get the max order value for this workspace to add new project at the end
    const maxOrder = await prisma.project.aggregate({
      where: {
        workspaceId: user.workspaceId,
      },
      _max: {
        order: true,
      },
    })

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        workspaceId: user.workspaceId,
        name: data.name.trim(),
        color: data.color || null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

