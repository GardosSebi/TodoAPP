import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Get user's pending invitations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        userId: session.user.id,
        status: 'PENDING',
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
      orderBy: {
        created_at: 'desc',
      },
    })

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        workspace: inv.workspace,
        inviter: inv.inviter,
        status: inv.status,
        created_at: inv.created_at.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

