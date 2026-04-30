import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  companyRowScope,
  contactRowScope,
  crmNotesWhereForSession,
  dealRowScope,
  isCrmAdmin,
} from '@/lib/crmAccess'
import { z } from 'zod'

const createInteractionSchema = z.object({
  type: z.string().trim().min(1).max(40),
  subject: z.string().trim().max(140).optional().nullable(),
  content: z.string().optional().nullable(),
  happened_at: z.string().datetime().optional().nullable(),
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
    if (workspaceIds.length === 0) return NextResponse.json({ interactions: [] })

    const baseWhere = await crmNotesWhereForSession(session, workspaceIds)
    if (!baseWhere) {
      return NextResponse.json({ interactions: [] })
    }
    const clauses: object[] = [baseWhere]
    if (contactId) clauses.push({ contactId })
    if (companyId) clauses.push({ companyId })
    if (dealId) clauses.push({ dealId })
    const where = clauses.length > 1 ? { AND: clauses } : baseWhere

    const interactions = await prisma.interaction.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { happened_at: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      interactions: interactions.map((interaction: any) => ({
        ...interaction,
        happened_at: interaction.happened_at.toISOString(),
        created_at: interaction.created_at.toISOString(),
        updated_at: interaction.updated_at.toISOString(),
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
    const data = createInteractionSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    })
    if (!user?.workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (data.contactId) {
      const ok = await prisma.contact.findFirst({
        where: {
          id: data.contactId,
          workspaceId: user.workspaceId,
          ...(isCrmAdmin(session) ? {} : contactRowScope(session)),
        },
        select: { id: true },
      })
      if (!ok) {
        return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 403 })
      }
    }
    if (data.companyId) {
      const ok = await prisma.company.findFirst({
        where: {
          id: data.companyId,
          workspaceId: user.workspaceId,
          ...(isCrmAdmin(session) ? {} : companyRowScope(session)),
        },
        select: { id: true },
      })
      if (!ok) {
        return NextResponse.json({ error: 'Company not found or access denied' }, { status: 403 })
      }
    }
    if (data.dealId) {
      const ok = await prisma.deal.findFirst({
        where: {
          id: data.dealId,
          workspaceId: user.workspaceId,
          ...(isCrmAdmin(session) ? {} : dealRowScope(session)),
        },
        select: { id: true },
      })
      if (!ok) {
        return NextResponse.json({ error: 'Deal not found or access denied' }, { status: 403 })
      }
    }

    const interaction = await prisma.interaction.create({
      data: {
        workspaceId: user.workspaceId,
        authorId: session.user.id,
        type: data.type.trim(),
        subject: data.subject?.trim() || null,
        content: data.content?.trim() || null,
        happened_at: data.happened_at ? new Date(data.happened_at) : new Date(),
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
        interaction: {
          ...interaction,
          happened_at: interaction.happened_at.toISOString(),
          created_at: interaction.created_at.toISOString(),
          updated_at: interaction.updated_at.toISOString(),
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
