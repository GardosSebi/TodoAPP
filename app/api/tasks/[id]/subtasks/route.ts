import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSubTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  order: z.number().int().min(0).optional(),
})

const updateSubTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

// GET all subtasks for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get task and check workspace access
    const task = await prisma.task.findFirst({
      where: {
        id,
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
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all subtasks for this task, ordered by order field then by created_at
    const subtasks = await prisma.subTask.findMany({
      where: {
        taskId: id,
      },
      orderBy: [
        { order: 'asc' },
        { created_at: 'asc' },
      ],
    })

    // Format dates for API response
    const formattedSubtasks = subtasks.map((subtask) => ({
      ...subtask,
      created_at: subtask.created_at.toISOString(),
      updated_at: subtask.updated_at.toISOString(),
      completed_at: subtask.completed_at?.toISOString() || null,
    }))

    return NextResponse.json({ subtasks: formattedSubtasks })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create a new subtask
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await request.json()
    const data = createSubTaskSchema.parse(body)

    // Get task and check workspace access
    const task = await prisma.task.findFirst({
      where: {
        id,
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
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // If order not provided, get the max order and add 1
    let order = data.order
    if (order === undefined) {
      const maxOrderSubtask = await prisma.subTask.findFirst({
        where: { taskId: id },
        orderBy: { order: 'desc' },
      })
      order = maxOrderSubtask ? maxOrderSubtask.order + 1 : 0
    }

    // Create subtask
    const subtask = await prisma.subTask.create({
      data: {
        taskId: id,
        title: data.title.trim(),
        order,
      },
    })

    // Format dates for API response
    const formattedSubtask = {
      ...subtask,
      created_at: subtask.created_at.toISOString(),
      updated_at: subtask.updated_at.toISOString(),
      completed_at: subtask.completed_at?.toISOString() || null,
    }

    return NextResponse.json({ subtask: formattedSubtask }, { status: 201 })
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



