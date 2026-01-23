import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Remove member from workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get member
    const member = await prisma.workspaceMember.findUnique({
      where: { id: params.memberId },
      include: {
        workspace: true,
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Verify user is workspace owner
    if (member.workspace.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only workspace owner can remove members' },
        { status: 403 }
      )
    }

    await prisma.workspaceMember.delete({
      where: { id: params.memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Error('Error removing workspace member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

