import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createCompanySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  website: z.string().url().max(255).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  status: z.enum(['LEAD', 'ACTIVE_CUSTOMER', 'PAST_CUSTOMER', 'PARTNER', 'INACTIVE']).optional(),
  notes: z.string().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const userWorkspaces = await prisma.workspace.findMany({
      where: {
        OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      select: { id: true },
    })
    const workspaceIds = userWorkspaces.map((w) => w.id)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ companies: [] })
    }

    const where: any = { workspaceId: { in: workspaceIds } }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ]
    }

    const companies = await (prisma as any).company.findMany({
      where,
      include: {
        primaryContact: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            contacts: true,
            deals: true,
          },
        },
      },
      orderBy: [{ updated_at: 'desc' }],
    })

    return NextResponse.json({
      companies: companies.map((company: any) => ({
        ...company,
        created_at: company.created_at.toISOString(),
        updated_at: company.updated_at.toISOString(),
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
    const data = createCompanySchema.parse(body)

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

    if (data.primaryContactId) {
      const contact = await (prisma as any).contact.findFirst({
        where: { id: data.primaryContactId, workspaceId: targetWorkspaceId },
        select: { id: true },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Primary contact not found in workspace' }, { status: 404 })
      }
    }

    const company = await (prisma as any).company.create({
      data: {
        workspaceId: targetWorkspaceId,
        name: data.name.trim(),
        website: data.website?.trim() || null,
        industry: data.industry?.trim() || null,
        size: data.size?.trim() || null,
        location: data.location?.trim() || null,
        status: data.status || 'LEAD',
        notes: data.notes?.trim() || null,
        primaryContactId: data.primaryContactId || null,
      },
    })

    return NextResponse.json(
      {
        company: {
          ...company,
          created_at: company.created_at.toISOString(),
          updated_at: company.updated_at.toISOString(),
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
