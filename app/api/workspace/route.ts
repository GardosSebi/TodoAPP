import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace (either owned or as member)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        workspaceMemberships: {
          include: {
            workspace: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    // Get workspace - either owned or as member
    let workspace = user?.workspace
    if (!workspace && user?.workspaceMemberships.length > 0) {
      workspace = user.workspaceMemberships[0].workspace
    }

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Check if current user is owner
    const isOwner = workspace.userId === session.user.id

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        created_at: workspace.created_at.toISOString(),
        updated_at: workspace.updated_at.toISOString(),
        isOwner,
        members: workspace.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: {
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
          },
          created_at: member.created_at.toISOString(),
        })),
      },
    })
  } catch (error) {
    // Error('Error fetching workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

