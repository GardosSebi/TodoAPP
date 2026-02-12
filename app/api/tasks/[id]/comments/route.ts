import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEmail, createMentionEmail } from '@/lib/email'

const commentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const data = commentSchema.parse(body)

    // Verify task access and get task with project info
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
        project: {
          select: {
            id: true,
            name: true,
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
    // Improved regex to handle names with spaces and special characters
    const mentionRegex = /@([^\s@]+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(data.content)) !== null) {
      mentions.push(match[1])
    }


    // Find mentioned users by name or email
    // Need to check both workspace owner and workspace members
    const workspace = await prisma.workspace.findUnique({
      where: { id: task.workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    // Get all users in workspace (owner + members)
    const allWorkspaceUsers: Array<{ id: string; name: string; email: string }> = []
    
    // Add workspace owner
    if (workspace?.user) {
      allWorkspaceUsers.push(workspace.user)
    }
    
    // Add workspace members
    workspace?.members.forEach((member) => {
      if (member.user) {
        allWorkspaceUsers.push(member.user)
      }
    })


    // Find mentioned users by matching names or emails (case-insensitive)
    const mentionedUsers: Array<{ id: string; name: string; email: string }> = []
    
    for (const mention of mentions) {
      const mentionLower = mention.toLowerCase()
      for (const user of allWorkspaceUsers) {
        const userNameLower = user.name?.toLowerCase() || ''
        const userEmailLower = user.email?.toLowerCase() || ''
        
        // Check if mention matches user name or email (exact match or contains)
        if (
          (userNameLower === mentionLower || userNameLower.includes(mentionLower) || mentionLower.includes(userNameLower)) ||
          (userEmailLower === mentionLower || userEmailLower.includes(mentionLower))
        ) {
          // Avoid duplicates
          if (!mentionedUsers.some(u => u.id === user.id)) {
            mentionedUsers.push(user)
          }
        }
      }
    }

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

    // Create notifications and send emails for mentioned users
    if (mentionedUserIds.length > 0) {
      const taskLink = task.projectId ? `/app/project/${task.projectId}?task=${taskId}` : `/app?task=${taskId}`
      const projectName = task.project?.name || null

      // Create notifications
      const notifications = mentionedUserIds.map((userId) => ({
        userId,
        type: 'MENTION',
        title: 'Ai fost menționat într-un comentariu',
        message: `${session.user.name || session.user.email} te-a menționat într-un comentariu la sarcina "${task.title}"`,
        link: taskLink,
      }))

      await prisma.notification.createMany({
        data: notifications,
      })

      // Send email notifications to mentioned users (excluding the commenter)
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id !== session.user.id && mentionedUser.email) {
          const emailNotification = createMentionEmail(
            mentionedUser.name || mentionedUser.email,
            session.user.name || session.user.email || 'Cineva',
            task.title,
            data.content.trim(),
            taskLink,
            projectName
          )
          emailNotification.to = mentionedUser.email
          await sendEmail(emailNotification)
        }
      }
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

