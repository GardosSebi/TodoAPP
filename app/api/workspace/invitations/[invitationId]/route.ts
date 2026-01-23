import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Accept invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> | { invitationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invitationId } = await Promise.resolve(params)

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: true,
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Verify the invitation is for the current user
    if (invitation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify invitation is pending
    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation already processed' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: invitation.userId,
        },
      },
    })

    if (existingMember) {
      // User is already a member, just update invitation status
      await prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      })
      return NextResponse.json({ success: true })
    }

    // Use transaction to accept invitation and create membership
    await prisma.$transaction(async (tx) => {
      // Update invitation status
      await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      })

      // Create workspace membership
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: invitation.userId,
          role: 'MEMBER',
          invited_by: invitation.invited_by,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const errorMessage = error?.message || 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Deny invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> | { invitationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invitationId } = await Promise.resolve(params)

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Verify the invitation is for the current user
    if (invitation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update invitation status to DENIED
    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: 'DENIED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

