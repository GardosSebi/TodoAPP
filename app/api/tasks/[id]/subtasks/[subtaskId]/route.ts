import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSubTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

// PATCH update a subtask
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, subtaskId } = await params

    const body = await request.json()
    const data = updateSubTaskSchema.parse(body)

    // Get subtask and check access through task
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        taskId: id,
      },
      include: {
        task: {
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
        },
      },
    })

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = subtask.task.userId === session.user.id
    const isWorkspaceOwner = subtask.task.workspace.userId === session.user.id
    const isWorkspaceMember = subtask.task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {}

    if (data.title !== undefined) {
      updateData.title = data.title.trim()
    }
    if (data.completed !== undefined) {
      updateData.completed = data.completed
      // Set completed_at timestamp
      if (data.completed && !subtask.completed) {
        updateData.completed_at = new Date()
      } else if (!data.completed && subtask.completed) {
        updateData.completed_at = null
      }
    }
    if (data.order !== undefined) {
      updateData.order = data.order
    }

    // Update subtask
    const updatedSubtask = await prisma.subTask.update({
      where: { id: subtaskId },
      data: updateData,
    })

    // Format dates for API response
    const formattedSubtask = {
      ...updatedSubtask,
      created_at: updatedSubtask.created_at.toISOString(),
      updated_at: updatedSubtask.updated_at.toISOString(),
      completed_at: updatedSubtask.completed_at?.toISOString() || null,
    }

    return NextResponse.json({ subtask: formattedSubtask })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE a subtask
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, subtaskId } = await params

    // Get subtask and check access through task
    const subtask = await prisma.subTask.findFirst({
      where: {
        id: subtaskId,
        taskId: id,
      },
      include: {
        task: {
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
        },
      },
    })

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = subtask.task.userId === session.user.id
    const isWorkspaceOwner = subtask.task.workspace.userId === session.user.id
    const isWorkspaceMember = subtask.task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete subtask
    await prisma.subTask.delete({
      where: { id: subtaskId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



