import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addTagSchema = z.object({
  tagId: z.string().uuid(),
})

// GET all tags for a task
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
        tags: {
          include: {
            tag: true,
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

    // Format tags for API response
    const formattedTags = task.tags.map((taskTag) => ({
      id: taskTag.tag.id,
      name: taskTag.tag.name,
      color: taskTag.tag.color,
      created_at: taskTag.tag.created_at.toISOString(),
    }))

    return NextResponse.json({ tags: formattedTags })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST add a tag to a task
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
    const data = addTagSchema.parse(body)

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

    // Check if tag exists and is in the same workspace
    const tag = await prisma.tag.findFirst({
      where: {
        id: data.tagId,
        workspaceId: task.workspaceId,
      },
    })

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found or not in same workspace' },
        { status: 404 }
      )
    }

    // Check if tag is already assigned to task
    const existingTaskTag = await prisma.taskTag.findUnique({
      where: {
        taskId_tagId: {
          taskId: id,
          tagId: data.tagId,
        },
      },
    })

    if (existingTaskTag) {
      return NextResponse.json(
        { error: 'Tag already assigned to task' },
        { status: 400 }
      )
    }

    // Create TaskTag
    await prisma.taskTag.create({
      data: {
        taskId: id,
        tagId: data.tagId,
      },
    })

    // Return the tag
    const formattedTag = {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      created_at: tag.created_at.toISOString(),
    }

    return NextResponse.json({ tag: formattedTag }, { status: 201 })
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

