import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get project with tasks
    const project = await prisma.project.findFirst({
      where: { id },
      include: {
        tasks: {
          where: {
            archived: false,
          },
        },
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if project is already completed
    if (project.completed) {
      return NextResponse.json({ error: 'Project is already completed' }, { status: 400 })
    }

    // Check if all tasks are completed
    const activeTasks = project.tasks.filter(
      (task) => task.status !== 'COMPLETED' && task.status !== 'FINISHED'
    )

    if (activeTasks.length > 0) {
      return NextResponse.json(
        { error: 'Not all tasks are completed' },
        { status: 400 }
      )
    }

    // Mark project as completed
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { completed: true },
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

