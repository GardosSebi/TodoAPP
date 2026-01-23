import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addMemberSchema = z.object({
  userId: z.string().uuid(),
})

// Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const members = await prisma.projectMember.findMany({
      where: {
        projectId: params.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ members })
  } catch (error) {
    // Error('Error fetching project members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Add member to project
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = addMemberSchema.parse(body)

    // Verify user is in admin's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role === 'ADMIN') {
      const isTeamMember = await prisma.teamMember.findFirst({
        where: {
          adminId: session.user.id,
          userId: data.userId,
        },
      })

      if (!isTeamMember) {
        return NextResponse.json(
          { error: 'User is not in your team' },
          { status: 403 }
        )
      }
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: data.userId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 400 }
      )
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: params.id,
        userId: data.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error adding project member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

