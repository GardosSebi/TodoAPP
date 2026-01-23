import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addTeamMemberSchema = z.object({
  email: z.string().email(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Get all team members for this admin
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        adminId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return NextResponse.json({ teamMembers })
  } catch (error) {
    // Error('Error fetching team members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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

    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = addTeamMemberSchema.parse(body)

    // Find the user by email
    const userToAdd = await prisma.user.findUnique({
      where: { email },
    })

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User with this email does not exist' },
        { status: 404 }
      )
    }

    // Prevent adding yourself
    if (userToAdd.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot add yourself as a team member' },
        { status: 400 }
      )
    }

    // Check if already a team member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        adminId_userId: {
          adminId: session.user.id,
          userId: userToAdd.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      )
    }

    // Add user to team
    const teamMember = await prisma.teamMember.create({
      data: {
        adminId: session.user.id,
        userId: userToAdd.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            created_at: true,
          },
        },
      },
    })

    return NextResponse.json({ teamMember }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error adding team member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
