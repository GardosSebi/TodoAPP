import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
  responsible: z.string().max(100).optional().nullable(),
  subtasks: z.array(z.string().trim().min(1)).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspaces where user is owner or member
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

    const template = await prisma.taskTemplate.findFirst({
      where: {
        id,
        workspaceId: { in: workspaceIds },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const formattedTemplate = {
      ...template,
      subtasks: JSON.parse(template.subtasks || '[]'),
      tagIds: JSON.parse(template.tagIds || '[]'),
      created_at: template.created_at.toISOString(),
      updated_at: template.updated_at.toISOString(),
    }

    return NextResponse.json({ template: formattedTemplate })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateTemplateSchema.parse(body)

    // Get workspaces where user is owner or member
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

    // Check if template exists and user has access
    const existingTemplate = await prisma.taskTemplate.findFirst({
      where: {
        id,
        workspaceId: { in: workspaceIds },
      },
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Verify tag IDs if provided
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: {
          id: { in: data.tagIds },
          workspaceId: existingTemplate.workspaceId,
        },
      })

      if (tags.length !== data.tagIds.length) {
        return NextResponse.json({ error: 'Invalid tag IDs' }, { status: 400 })
      }
    }

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.title !== undefined) updateData.title = data.title
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.responsible !== undefined) updateData.responsible = data.responsible
    if (data.subtasks !== undefined) updateData.subtasks = JSON.stringify(data.subtasks)
    if (data.tagIds !== undefined) updateData.tagIds = JSON.stringify(data.tagIds)

    const template = await prisma.taskTemplate.update({
      where: { id },
      data: updateData,
    })

    const formattedTemplate = {
      ...template,
      subtasks: JSON.parse(template.subtasks || '[]'),
      tagIds: JSON.parse(template.tagIds || '[]'),
      created_at: template.created_at.toISOString(),
      updated_at: template.updated_at.toISOString(),
    }

    return NextResponse.json({ template: formattedTemplate })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspaces where user is owner or member
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

    // Check if template exists and user has access
    const template = await prisma.taskTemplate.findFirst({
      where: {
        id,
        workspaceId: { in: workspaceIds },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    await prisma.taskTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

