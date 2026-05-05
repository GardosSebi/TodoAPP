import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reorderSchema = z.object({
  projectIds: z.array(z.string()),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectIds } = reorderSchema.parse(body)

    if (!projectIds || projectIds.length === 0) {
      return NextResponse.json({ error: 'Project IDs are required' }, { status: 400 })
    }

    // Verify that all projects belong to workspaces the user has access to
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

    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        workspaceId: { in: workspaceIds },
      },
    })

    if (projects.length !== projectIds.length) {
      return NextResponse.json(
        { error: 'Some projects not found or access denied' },
        { status: 403 }
      )
    }

    // Update order for each project
    const updatePromises = projectIds.map((projectId, index) =>
      prisma.project.update({
        where: { id: projectId },
        data: { order: index },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
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

