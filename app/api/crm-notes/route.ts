import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createCrmNoteSchema = z.object({
  content: z.string().trim().min(1),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const companyId = searchParams.get('companyId')
    const dealId = searchParams.get('dealId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const userWorkspaces = await prisma.workspace.findMany({
      where: { OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
      select: { id: true },
    })
    const workspaceIds = userWorkspaces.map((w) => w.id)
    if (workspaceIds.length === 0) return NextResponse.json({ notes: [] })

    const where: any = { workspaceId: { in: workspaceIds } }
    if (contactId) where.contactId = contactId
    if (companyId) where.companyId = companyId
    if (dealId) where.dealId = dealId

    const notes = await (prisma as any).cRMNote.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      notes: notes.map((note: any) => ({
        ...note,
        created_at: note.created_at.toISOString(),
        updated_at: note.updated_at.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createCrmNoteSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })
    if (!user?.workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const note = await (prisma as any).cRMNote.create({
      data: {
        workspaceId: user.workspaceId,
        authorId: session.user.id,
        content: data.content.trim(),
        contactId: data.contactId || null,
        companyId: data.companyId || null,
        dealId: data.dealId || null,
        taskId: data.taskId || null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(
      {
        note: {
          ...note,
          created_at: note.created_at.toISOString(),
          updated_at: note.updated_at.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
