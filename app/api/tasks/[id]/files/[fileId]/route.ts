import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id, fileId } = await params

    // Verify task exists and user has access (owner or workspace member)
    const task = await prisma.task.findFirst({
      where: {
        id,
      },
      include: {
        workspace: {
          select: {
            id: true,
            userId: true,
            members: {
              where: {
                userId: session.user.id,
              },
            },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Sarcina nu a fost găsită' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get file record
    const taskFile = await (prisma as any).taskFile.findFirst({
      where: {
        id: fileId,
        taskId: id,
      },
    })

    if (!taskFile) {
      return NextResponse.json({ error: 'Fișierul nu a fost găsit' }, { status: 404 })
    }

    // Delete physical file
    const filePath = join(process.cwd(), 'public', taskFile.filePath)
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {})
    }

    // Delete file record
    await (prisma as any).taskFile.delete({
      where: {
        id: fileId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Error('Error deleting file:', error)
    return NextResponse.json(
      { error: 'Eroare la ștergerea fișierului' },
      { status: 500 }
    )
  }
}

