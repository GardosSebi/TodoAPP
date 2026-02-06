import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, createWorkspaceMemberEmail } from '@/lib/email'

// Accept invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { invitationId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get inviter and workspace info for email
    const invitationWithDetails = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
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
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

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

    // Create notification and send email
    if (invitationWithDetails && invitationWithDetails.user.id !== invitationWithDetails.inviter.id) {
      await prisma.notification.create({
        data: {
          userId: invitationWithDetails.user.id,
          type: 'WORKSPACE_MEMBER_ADDED',
          title: 'Ai fost adăugat la un workspace',
          message: `${invitationWithDetails.inviter.name || invitationWithDetails.inviter.email || 'Cineva'} te-a adăugat la workspace-ul "${invitationWithDetails.workspace.name}"`,
          link: `/app`,
        },
      })

      // Send email notification
      if (invitationWithDetails.user.email) {
        const emailNotification = createWorkspaceMemberEmail(
          invitationWithDetails.user.name || invitationWithDetails.user.email,
          invitationWithDetails.inviter.name || invitationWithDetails.inviter.email || 'Cineva',
          invitationWithDetails.workspace.name,
          `/app`
        )
        emailNotification.to = invitationWithDetails.user.email
        await sendEmail(emailNotification)
      }
    }

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
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { invitationId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

