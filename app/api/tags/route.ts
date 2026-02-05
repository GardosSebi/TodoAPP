import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

// GET all tags for user's accessible workspaces
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
      return NextResponse.json({ tags: [] })
    }

    // Get all tags from accessible workspaces
    const tags = await prisma.tag.findMany({
      where: {
        workspaceId: { in: workspaceIds },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Format dates for API response
    const formattedTags = tags.map((tag) => ({
      ...tag,
      created_at: tag.created_at.toISOString(),
      updated_at: tag.updated_at.toISOString(),
    }))

    return NextResponse.json({ tags: formattedTags })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create a new tag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createTagSchema.parse(body)

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })

    if (!user?.workspaceId) {
      return NextResponse.json(
        { error: 'User workspace not found' },
        { status: 404 }
      )
    }

    // Check if tag with same name already exists in workspace
    const existingTag = await prisma.tag.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: user.workspaceId,
          name: data.name.trim(),
        },
      },
    })

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag with this name already exists in workspace' },
        { status: 400 }
      )
    }

    // Default colors if not provided
    const defaultColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
    ]

    // Create tag
    const tag = await prisma.tag.create({
      data: {
        workspaceId: user.workspaceId,
        name: data.name.trim(),
        color: data.color || defaultColors[Math.floor(Math.random() * defaultColors.length)],
      },
    })

    // Format dates for API response
    const formattedTag = {
      ...tag,
      created_at: tag.created_at.toISOString(),
      updated_at: tag.updated_at.toISOString(),
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

