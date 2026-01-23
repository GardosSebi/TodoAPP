import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
})

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
    const data = updateProjectSchema.parse(body)

    // Check if user has access to project (owner or workspace member)
    // But only project owner can edit
    const project = await prisma.project.findFirst({
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

    // Only project owner can edit
    if (!isProjectOwner) {
      return NextResponse.json(
        { error: 'Only project owner can edit project' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (data.name !== undefined) {
      updateData.name = data.name.trim()
    }
    if (data.color !== undefined) {
      updateData.color = data.color || null
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error updating project:', error)
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

    // Only project owner can delete
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    await prisma.project.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

