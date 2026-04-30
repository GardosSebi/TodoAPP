import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { companyRowScope, contactRowScope, dealRowScope, isCrmAdmin } from '@/lib/crmAccess'
import { z } from 'zod'

const createDealSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(140),
  description: z.string().optional().nullable(),
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  value: z.number().min(0).optional(),
  expected_close: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const stage = searchParams.get('stage')
    const companyId = searchParams.get('companyId')

    const userWorkspaces = await prisma.workspace.findMany({
      where: {
        OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      select: { id: true },
    })
    const workspaceIds = userWorkspaces.map((w) => w.id)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ deals: [] })
    }

    const clauses: Record<string, unknown>[] = [{ workspaceId: { in: workspaceIds } }]
    if (!isCrmAdmin(session)) {
      clauses.push(dealRowScope(session) as Record<string, unknown>)
    }
    if (stage) clauses.push({ stage })
    if (companyId) clauses.push({ companyId })
    if (search) {
      clauses.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    const where = { AND: clauses }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true },
        },
        contact: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ updated_at: 'desc' }],
    })

    return NextResponse.json({
      deals: deals.map((deal: any) => ({
        ...deal,
        expected_close: deal.expected_close?.toISOString() || null,
        created_at: deal.created_at.toISOString(),
        updated_at: deal.updated_at.toISOString(),
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
    const data = createDealSchema.parse(body)

    let targetWorkspaceId = data.workspaceId
    if (!targetWorkspaceId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { workspaceId: true },
      })
      targetWorkspaceId = user?.workspaceId || undefined
    }

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceAccess = await prisma.workspace.findFirst({
      where: {
        id: targetWorkspaceId,
        OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      select: { id: true },
    })
    if (!workspaceAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (data.companyId) {
      const company = await prisma.company.findFirst({
        where: {
          id: data.companyId,
          workspaceId: targetWorkspaceId,
          ...(isCrmAdmin(session) ? {} : companyRowScope(session)),
        },
        select: { id: true },
      })
      if (!company) {
        return NextResponse.json({ error: 'Company not found in workspace' }, { status: 404 })
      }
    }

    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: data.contactId,
          workspaceId: targetWorkspaceId,
          ...(isCrmAdmin(session) ? {} : contactRowScope(session)),
        },
        select: { id: true },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found in workspace' }, { status: 404 })
      }
    }

    const effectiveOwnerId = isCrmAdmin(session)
      ? data.ownerId ?? session.user.id
      : session.user.id

    if (isCrmAdmin(session) && data.ownerId) {
      const workspaceOwnerOrMember = await prisma.workspace.findFirst({
        where: {
          id: targetWorkspaceId,
          OR: [{ userId: data.ownerId }, { members: { some: { userId: data.ownerId } } }],
        },
        select: { id: true },
      })
      if (!workspaceOwnerOrMember) {
        return NextResponse.json({ error: 'Owner is not part of workspace' }, { status: 404 })
      }
    }

    const deal = await prisma.deal.create({
      data: {
        workspaceId: targetWorkspaceId,
        companyId: data.companyId || null,
        contactId: data.contactId || null,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        stage: data.stage || 'NEW',
        value: data.value ?? 0,
        expected_close: data.expected_close ? new Date(data.expected_close) : null,
        ownerId: effectiveOwnerId,
        created_by: session.user.id,
      },
    })

    return NextResponse.json(
      {
        deal: {
          ...deal,
          expected_close: deal.expected_close?.toISOString() || null,
          created_at: deal.created_at.toISOString(),
          updated_at: deal.updated_at.toISOString(),
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
