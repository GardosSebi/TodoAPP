import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'NOT_STARTED', 'IN_PROGRESS', 'FINISHED']).optional(),
  responsible: z.string().max(100).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get task and check workspace access
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
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
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Format dates and files for API response
    const formattedTask = {
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
      files: task.files.map((file) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
    }

    return NextResponse.json({ task: formattedTask })
  } catch (error) {
    // Error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateTaskSchema.parse(body)

    // Get task and check workspace access
    const existingTask = await prisma.task.findFirst({
      where: {
        id: params.id,
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

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = existingTask.userId === session.user.id
    const isWorkspaceOwner = existingTask.workspace.userId === session.user.id
    const isWorkspaceMember = existingTask.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate project access if provided
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
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
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }

      // Check project access
      const isProjectOwner = project.userId === session.user.id
      const isProjectWorkspaceOwner = project.workspace.userId === session.user.id
      const isProjectWorkspaceMember = project.workspace.members.length > 0

      if (!isProjectOwner && !isProjectWorkspaceOwner && !isProjectWorkspaceMember) {
        return NextResponse.json(
          { error: 'Access denied to project' },
          { status: 403 }
        )
      }
    }

    const updateData: any = {}

    if (data.title !== undefined) {
      updateData.title = data.title.trim()
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null
    }
    if (data.due_at !== undefined) {
      updateData.due_at = data.due_at ? new Date(data.due_at) : null
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority
    }
    if (data.projectId !== undefined) {
      updateData.projectId = data.projectId || null
    }
    if (data.status !== undefined) {
      // Map FINISHED to COMPLETED for database
      const dbStatus = data.status === 'FINISHED' ? 'COMPLETED' : data.status
      updateData.status = dbStatus
      
      // Handle completed_at timestamp
      if (dbStatus === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        updateData.completed_at = new Date()
      } else if (dbStatus !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
        updateData.completed_at = null
      }
    }
    if (data.responsible !== undefined) {
      // Only workspace owner can assign responsible person
      if (!isWorkspaceOwner) {
        return NextResponse.json(
          { error: 'Only workspace owner can assign responsible person' },
          { status: 403 }
        )
      }
      updateData.responsible = data.responsible?.trim() || null
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
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

    // Format dates and files for API response
    const formattedTask = {
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
      files: task.files.map((file) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
    }

    // Map COMPLETED back to FINISHED for Kanban board if needed
    const responseTask = {
      ...formattedTask,
      status: task.status === 'COMPLETED' && task.projectId ? 'FINISHED' : task.status,
    }

    return NextResponse.json({ task: responseTask })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get task and check workspace access
    const task = await prisma.task.findFirst({
      where: {
        id: params.id,
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

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    // But only task owner or workspace owner can delete
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id

    if (!isTaskOwner && !isWorkspaceOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.task.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

