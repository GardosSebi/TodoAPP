import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCrmAdmin } from '@/lib/crmAccess'
import { z } from 'zod'

const bodySchema = z.object({
  entity: z.enum(['contact', 'company', 'deal']),
  id: z.string().uuid(),
  /** User who may see/edit this CRM row (USER role). Null clears assignment (contact/company) or resets deal owner to null. */
  assignedToUserId: z.string().uuid().nullable(),
})

async function assertUserInWorkspace(workspaceId: string, userId: string) {
  const ok = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  })
  return Boolean(ok)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isCrmAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { entity, id, assignedToUserId } = bodySchema.parse(body)

    if (assignedToUserId) {
      const target = await prisma.user.findUnique({
        where: { id: assignedToUserId },
        select: { id: true, role: true },
      })
      if (!target) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    if (entity === 'contact') {
      const row = await prisma.contact.findFirst({
        where: { id },
        select: { workspaceId: true },
      })
      if (!row) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      if (assignedToUserId && !(await assertUserInWorkspace(row.workspaceId, assignedToUserId))) {
        return NextResponse.json(
          { error: 'Assignee must be workspace owner or member' },
          { status: 400 }
        )
      }
      const updated = await prisma.contact.update({
        where: { id },
        data: { assigned_to: assignedToUserId },
      })
      return NextResponse.json({
        ok: true,
        contact: {
          ...updated,
          created_at: updated.created_at.toISOString(),
          updated_at: updated.updated_at.toISOString(),
        },
      })
    }

    if (entity === 'company') {
      const row = await prisma.company.findFirst({
        where: { id },
        select: { workspaceId: true },
      })
      if (!row) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 })
      }
      if (assignedToUserId && !(await assertUserInWorkspace(row.workspaceId, assignedToUserId))) {
        return NextResponse.json(
          { error: 'Assignee must be workspace owner or member' },
          { status: 400 }
        )
      }
      const updated = await prisma.company.update({
        where: { id },
        data: { assigned_to: assignedToUserId },
      })
      return NextResponse.json({
        ok: true,
        company: {
          ...updated,
          created_at: updated.created_at.toISOString(),
          updated_at: updated.updated_at.toISOString(),
        },
      })
    }

    const row = await prisma.deal.findFirst({
      where: { id },
      select: { workspaceId: true },
    })
    if (!row) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }
    if (assignedToUserId && !(await assertUserInWorkspace(row.workspaceId, assignedToUserId))) {
      return NextResponse.json(
        { error: 'Owner must be workspace owner or member' },
        { status: 400 }
      )
    }
    const updated = await prisma.deal.update({
      where: { id },
      data: { ownerId: assignedToUserId },
    })
    return NextResponse.json({
      ok: true,
      deal: {
        ...updated,
        expected_close: updated.expected_close?.toISOString() || null,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
