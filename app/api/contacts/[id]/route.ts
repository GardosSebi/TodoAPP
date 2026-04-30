import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { companyRowScope, contactRowScope, isCrmAdmin } from '@/lib/crmAccess'
import { z } from 'zod'

const updateContactSchema = z.object({
  companyId: z.string().uuid().optional().nullable(),
  first_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  job_title: z.string().max(100).optional().nullable(),
  status: z.enum(['LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'INACTIVE']).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
        ...(isCrmAdmin(session) ? {} : contactRowScope(session)),
      },
      include: {
        company: true,
        deals: {
          orderBy: { updated_at: 'desc' },
          take: 10,
        },
        tasks: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({
      contact: {
        ...contact,
        created_at: contact.created_at.toISOString(),
        updated_at: contact.updated_at.toISOString(),
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
    const data = updateContactSchema.parse(body)

    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
        ...(isCrmAdmin(session) ? {} : contactRowScope(session)),
      },
      select: {
        id: true,
        workspaceId: true,
      },
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })
    }

    if (data.companyId) {
      const company = await prisma.company.findFirst({
        where: {
          id: data.companyId,
          workspaceId: existingContact.workspaceId,
          ...(isCrmAdmin(session) ? {} : companyRowScope(session)),
        },
        select: { id: true },
      })
      if (!company) {
        return NextResponse.json({ error: 'Company not found in workspace' }, { status: 404 })
      }
    }

    const updateData: any = {}
    if (data.companyId !== undefined) updateData.companyId = data.companyId || null
    if (data.first_name !== undefined) updateData.first_name = data.first_name.trim()
    if (data.last_name !== undefined) updateData.last_name = data.last_name.trim()
    if (data.email !== undefined) updateData.email = data.email?.trim() || null
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null
    if (data.job_title !== undefined) updateData.job_title = data.job_title?.trim() || null
    if (data.status !== undefined) updateData.status = data.status
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
    })

    if (data.status !== undefined) {
      await prisma.activity.create({
        data: {
          workspaceId: existingContact.workspaceId,
          userId: session.user.id,
          type: 'CONTACT_STATUS_UPDATED',
          description: `Status contact actualizat la ${data.status}`,
        },
      })
    }

    return NextResponse.json({
      contact: {
        ...contact,
        created_at: contact.created_at.toISOString(),
        updated_at: contact.updated_at.toISOString(),
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

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        workspace: {
          OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
        ...(isCrmAdmin(session) ? {} : contactRowScope(session)),
      },
      select: { id: true },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })
    }

    await prisma.contact.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
