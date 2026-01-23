import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const commentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
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

    const taskId = params.id

    // Verify task access
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: {
        workspace: {
          select: {
            id: true,
            userId: true,
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check workspace access
    const hasAccess =
      task.workspace.userId === session.user.id ||
      task.workspace.members.length > 0

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    const formattedComments = comments.map((comment: any) => ({
      ...comment,
      created_at: comment.created_at.toISOString(),
      updated_at: comment.updated_at.toISOString(),
    }))

    return NextResponse.json({ comments: formattedComments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taskId = params.id
    const body = await request.json()
    const data = commentSchema.parse(body)

    // Verify task access
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: {
        workspace: {
          select: {
            id: true,
            userId: true,
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check workspace access
    const hasAccess =
      task.workspace.userId === session.user.id ||
      task.workspace.members.length > 0

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Extract mentions from content (@username pattern)
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(data.content)) !== null) {
      mentions.push(match[1])
    }

    // Find mentioned users by name or email
    const mentionedUsers = await prisma.user.findMany({
      where: {
        workspaceId: task.workspaceId,
        OR: [
          { name: { in: mentions, mode: 'insensitive' } },
          { email: { in: mentions, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    const mentionedUserIds = mentionedUsers.map((u) => u.id)

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId: session.user.id,
        content: data.content.trim(),
        mentions: mentionedUserIds,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        taskId,
        workspaceId: task.workspaceId,
        userId: session.user.id,
        type: 'COMMENT_ADDED',
        description: `${session.user.name || session.user.email} added a comment`,
        metadata: JSON.stringify({ commentId: comment.id }),
      },
    })

    // Create notifications for mentioned users
    if (mentionedUserIds.length > 0) {
      const notifications = mentionedUserIds.map((userId) => ({
        userId,
        type: 'MENTION',
        title: 'You were mentioned in a comment',
        message: `${session.user.name || session.user.email} mentioned you in a comment on task "${task.title}"`,
        link: `/app/project/${task.projectId || 'inbox'}?task=${taskId}`,
      }))

      await prisma.notification.createMany({
        data: notifications,
      })
    }

    return NextResponse.json(
      {
        comment: {
          ...comment,
          created_at: comment.created_at.toISOString(),
          updated_at: comment.updated_at.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

