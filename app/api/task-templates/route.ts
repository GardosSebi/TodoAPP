import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(120),
  notes: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
  responsible: z.string().max(100).optional().nullable(),
  subtasks: z.array(z.string().trim().min(1)).optional().default([]),
  tagIds: z.array(z.string().uuid()).optional().default([]),
})

export async function GET(request: NextRequest) {
  try {
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

    if (workspaceIds.length === 0) {
      return NextResponse.json({ templates: [] })
    }

    const templates = await prisma.taskTemplate.findMany({
      where: {
        workspaceId: { in: workspaceIds },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    // Parse JSON fields
    const formattedTemplates = templates.map((template) => ({
      ...template,
      subtasks: JSON.parse(template.subtasks || '[]'),
      tagIds: JSON.parse(template.tagIds || '[]'),
      created_at: template.created_at.toISOString(),
      updated_at: template.updated_at.toISOString(),
    }))

    return NextResponse.json({ templates: formattedTemplates })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createTemplateSchema.parse(body)

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: user.workspaceId,
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Verify tag IDs belong to the workspace
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: {
          id: { in: data.tagIds },
          workspaceId: user.workspaceId,
        },
      })

      if (tags.length !== data.tagIds.length) {
        return NextResponse.json({ error: 'Invalid tag IDs' }, { status: 400 })
      }
    }

    const template = await prisma.taskTemplate.create({
      data: {
        userId: session.user.id,
        workspaceId: user.workspaceId,
        name: data.name,
        description: data.description || null,
        title: data.title,
        notes: data.notes || null,
        priority: data.priority,
        responsible: data.responsible || null,
        subtasks: JSON.stringify(data.subtasks || []),
        tagIds: JSON.stringify(data.tagIds || []),
      },
    })

    const formattedTemplate = {
      ...template,
      subtasks: JSON.parse(template.subtasks || '[]'),
      tagIds: JSON.parse(template.tagIds || '[]'),
      created_at: template.created_at.toISOString(),
      updated_at: template.updated_at.toISOString(),
    }

    return NextResponse.json({ template: formattedTemplate }, { status: 201 })
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

