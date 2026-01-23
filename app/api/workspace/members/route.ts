import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const inviteMemberSchema = z.object({
  email: z.string().email(),
})

// Get workspace members
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's primary workspace (owned first, then first membership)
    const ownedWorkspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id,
      },
      select: { id: true },
    })

    let targetWorkspaceId = ownedWorkspace?.id

    // If no owned workspace, get first workspace membership
    if (!targetWorkspaceId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          userId: session.user.id,
        },
        select: { workspaceId: true },
      })
      targetWorkspaceId = membership?.workspaceId
    }

    if (!targetWorkspaceId) {
      return NextResponse.json(
        { error: 'No accessible workspace found' },
        { status: 404 }
      )
    }

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: targetWorkspaceId,
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
      orderBy: {
        created_at: 'asc',
      },
    })

    // Return only members (not the owner)
    const allMembers = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
      created_at: m.created_at,
    }))

    return NextResponse.json({
      members: allMembers.map((m) => ({
        ...m,
        created_at: m.created_at.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Invite member to workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = inviteMemberSchema.parse(body)

    // Verify user is workspace owner (can only invite to owned workspace)
    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id,
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Only workspace owner can invite members' },
        { status: 403 }
      )
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (!invitedUser) {
      return NextResponse.json(
        { error: 'User with this email not found' },
        { status: 404 }
      )
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: invitedUser.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a workspace member' },
        { status: 400 }
      )
    }

    // Check if user is trying to invite themselves
    if (invitedUser.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot invite yourself' },
        { status: 400 }
      )
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.workspaceInvitation.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: invitedUser.id,
        },
      },
    })

    if (existingInvitation && existingInvitation.status === 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation already sent' },
        { status: 400 }
      )
    }

    // Create or update invitation
    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: invitedUser.id,
        },
      },
      create: {
        workspaceId: workspace.id,
        userId: invitedUser.id,
        invited_by: session.user.id,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING',
        invited_by: session.user.id,
        updated_at: new Date(),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          workspace: invitation.workspace,
          inviter: invitation.inviter,
          status: invitation.status,
          created_at: invitation.created_at.toISOString(),
        },
      },
      { status: 201 }
    )
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

