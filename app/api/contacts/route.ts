import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createContactSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional().nullable(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  job_title: z.string().max(100).optional().nullable(),
  status: z.enum(['LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'INACTIVE']).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  notes: z.string().optional().nullable(),
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
    const companyId = searchParams.get('companyId')
    const tag = searchParams.get('tag')

    const userWorkspaces = await prisma.workspace.findMany({
      where: {
        OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      select: { id: true },
    })

    const workspaceIds = userWorkspaces.map((w) => w.id)
    if (workspaceIds.length === 0) {
      return NextResponse.json({ contacts: [] })
    }

    const where: any = {
      workspaceId: { in: workspaceIds },
    }

    if (status) {
      where.status = status
    }

    if (companyId) {
      where.companyId = companyId
    }

    if (tag) {
      where.tags = { has: tag }
    }

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const contacts = await (prisma as any).contact.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ updated_at: 'desc' }],
    })

    return NextResponse.json({
      contacts: contacts.map((contact: any) => ({
        ...contact,
        created_at: contact.created_at.toISOString(),
        updated_at: contact.updated_at.toISOString(),
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
    const data = createContactSchema.parse(body)

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
      const company = await (prisma as any).company.findFirst({
        where: { id: data.companyId, workspaceId: targetWorkspaceId },
        select: { id: true },
      })
      if (!company) {
        return NextResponse.json({ error: 'Company not found in workspace' }, { status: 404 })
      }
    }

    const contact = await (prisma as any).contact.create({
      data: {
        workspaceId: targetWorkspaceId,
        companyId: data.companyId || null,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        job_title: data.job_title?.trim() || null,
        status: data.status || 'LEAD',
        tags: data.tags || [],
        notes: data.notes?.trim() || null,
        created_by: session.user.id,
      },
    })

    return NextResponse.json(
      {
        contact: {
          ...contact,
          created_at: contact.created_at.toISOString(),
          updated_at: contact.updated_at.toISOString(),
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
