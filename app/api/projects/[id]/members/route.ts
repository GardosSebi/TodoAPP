import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEmail, createProjectMemberEmail } from '@/lib/email'

const addMemberSchema = z.object({
  userId: z.string().uuid(),
})

// Get project members
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

    // Verify user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id,
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
        projectId: id,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id,
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
          projectId: id,
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

    // Get project name for email
    const projectWithName = await prisma.project.findUnique({
      where: { id },
      select: { name: true },
    })

    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId: data.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    // Get inviter info
    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
      },
    })

    // Create notification
    if (member.user.id !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: member.user.id,
          type: 'PROJECT_MEMBER_ADDED',
          title: 'Ai fost adăugat la un proiect',
          message: `${inviter?.name || inviter?.email || 'Cineva'} te-a adăugat la proiectul "${projectWithName?.name || 'Proiect'}"`,
          link: `/app/project/${id}`,
        },
      })

      // Send email notification
      if (member.user.email) {
        const emailNotification = createProjectMemberEmail(
          member.user.name || member.user.email,
          inviter?.name || inviter?.email || 'Cineva',
          projectWithName?.name || 'Proiect',
          `/app/project/${id}`
        )
        emailNotification.to = member.user.email
        await sendEmail(emailNotification)
      }
    }

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

