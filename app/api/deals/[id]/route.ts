import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateDealSchema = z.object({
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().optional().nullable(),
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  value: z.number().min(0).optional(),
  expected_close: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deal = await (prisma as any).deal.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      include: {
        company: true,
        contact: true,
        tasks: {
          orderBy: [{ created_at: 'desc' }],
          take: 20,
        },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({
      deal: {
        ...deal,
        expected_close: deal.expected_close?.toISOString() || null,
        created_at: deal.created_at.toISOString(),
        updated_at: deal.updated_at.toISOString(),
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
    const data = updateDealSchema.parse(body)

    const existingDeal = await (prisma as any).deal.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: {
        workspaceId: true,
      },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: 'Deal not found or access denied' }, { status: 404 })
    }

    if (data.companyId) {
      const company = await (prisma as any).company.findFirst({
        where: { id: data.companyId, workspaceId: existingDeal.workspaceId },
        select: { id: true },
      })
      if (!company) {
        return NextResponse.json({ error: 'Company not found in workspace' }, { status: 404 })
      }
    }

    if (data.contactId) {
      const contact = await (prisma as any).contact.findFirst({
        where: { id: data.contactId, workspaceId: existingDeal.workspaceId },
        select: { id: true },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found in workspace' }, { status: 404 })
      }
    }

    if (data.ownerId) {
      const workspaceOwnerOrMember = await prisma.workspace.findFirst({
        where: {
          id: existingDeal.workspaceId,
          OR: [{ userId: data.ownerId }, { members: { some: { userId: data.ownerId } } }],
        },
        select: { id: true },
      })
      if (!workspaceOwnerOrMember) {
        return NextResponse.json({ error: 'Owner is not part of workspace' }, { status: 404 })
      }
    }

    const updateData: any = {}
    if (data.companyId !== undefined) updateData.companyId = data.companyId || null
    if (data.contactId !== undefined) updateData.contactId = data.contactId || null
    if (data.title !== undefined) updateData.title = data.title.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() || null
    if (data.stage !== undefined) updateData.stage = data.stage
    if (data.value !== undefined) updateData.value = data.value
    if (data.expected_close !== undefined) {
      updateData.expected_close = data.expected_close ? new Date(data.expected_close) : null
    }
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId || null

    const deal = await (prisma as any).deal.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      deal: {
        ...deal,
        expected_close: deal.expected_close?.toISOString() || null,
        created_at: deal.created_at.toISOString(),
        updated_at: deal.updated_at.toISOString(),
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

    const deal = await (prisma as any).deal.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
      select: { id: true },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found or access denied' }, { status: 404 })
    }

    await (prisma as any).deal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
