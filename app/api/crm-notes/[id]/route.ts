import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCrmLinkedRow } from '@/lib/crmAccess'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const note = await prisma.cRMNote.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: {
        id: true,
        authorId: true,
        contactId: true,
        companyId: true,
        dealId: true,
        taskId: true,
      },
    })

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    if (!(await canAccessCrmLinkedRow(session, note))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.cRMNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
