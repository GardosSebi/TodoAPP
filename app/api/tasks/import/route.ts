import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const importTaskSchema = z.object({
  title: z.string().min(1).max(120),
  notes: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(3).default(0),
})

const importRequestSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(importTaskSchema),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, tasks } = importRequestSchema.parse(body)

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            userId: true,
            members: {
              where: {
                userId: session.user.id,
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check access: user is project owner OR workspace owner OR workspace member
    const isProjectOwner = project.userId === session.user.id
    const isWorkspaceOwner = project.workspace.userId === session.user.id
    const isWorkspaceMember = project.workspace.members.length > 0

    if (!isProjectOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Create tasks in bulk
    const createdTasks = await Promise.all(
      tasks.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            notes: task.notes || null,
            due_at: task.due_at ? new Date(task.due_at) : null,
            priority: task.priority,
            status: 'NOT_STARTED',
            userId: session.user.id,
            workspaceId: userWorkspace.id,
            projectId: projectId,
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
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      count: createdTasks.length,
      tasks: createdTasks.map((task) => ({
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
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error importing tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

