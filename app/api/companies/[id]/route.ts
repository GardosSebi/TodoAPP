import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  website: z.string().url().max(255).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  status: z.enum(['LEAD', 'ACTIVE_CUSTOMER', 'PAST_CUSTOMER', 'PARTNER', 'INACTIVE']).optional(),
  notes: z.string().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const company = await (prisma as any).company.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      include: {
        contacts: {
          orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
        },
        deals: {
          orderBy: [{ updated_at: 'desc' }],
          take: 10,
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({
      company: {
        ...company,
        created_at: company.created_at.toISOString(),
        updated_at: company.updated_at.toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateCompanySchema.parse(body)

    const existingCompany = await (prisma as any).company.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: { workspaceId: true },
    })

    if (!existingCompany) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    if (data.primaryContactId) {
      const contact = await (prisma as any).contact.findFirst({
        where: { id: data.primaryContactId, workspaceId: existingCompany.workspaceId },
        select: { id: true },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Primary contact not found in workspace' }, { status: 404 })
      }
    }

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name.trim()
    if (data.website !== undefined) updateData.website = data.website?.trim() || null
    if (data.industry !== undefined) updateData.industry = data.industry?.trim() || null
    if (data.size !== undefined) updateData.size = data.size?.trim() || null
    if (data.location !== undefined) updateData.location = data.location?.trim() || null
    if (data.status !== undefined) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
    if (data.primaryContactId !== undefined) updateData.primaryContactId = data.primaryContactId || null

    const company = await (prisma as any).company.update({
      where: { id },
      data: updateData,
    })

    if (data.status !== undefined) {
      await prisma.activity.create({
        data: {
          workspaceId: existingCompany.workspaceId,
          userId: session.user.id,
          type: 'COMPANY_STATUS_UPDATED',
          description: `Status companie actualizat la ${data.status}`,
        },
      })
    }

    return NextResponse.json({
      company: {
        ...company,
        created_at: company.created_at.toISOString(),
        updated_at: company.updated_at.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const company = await (prisma as any).company.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: { id: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    await (prisma as any).company.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
