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

    // Get project
    const project = await prisma.project.findFirst({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only project owner can reopen
    if (project.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owner can reopen project' },
        { status: 403 }
      )
    }

    // Check if project is completed
    if (!project.completed) {
      return NextResponse.json({ error: 'Project is not completed' }, { status: 400 })
    }

    // Reopen project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { completed: false },
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

