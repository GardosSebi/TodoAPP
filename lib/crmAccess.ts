import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Filtru listă CRM (note + interacțiuni): aceleași câmpuri în ambele modele. */
export type CrmFeedListWhere = Prisma.CRMNoteWhereInput

/** CRM: ADMIN sees all records in workspace; USER only own + assigned. */
export function isCrmAdmin(session: Session | null): boolean {
  const role = session?.user && (session.user as { role?: string }).role
  return role === 'ADMIN'
}

export function contactRowScope(session: Session | null) {
  if (!session?.user?.id || isCrmAdmin(session)) return {}
  return {
    OR: [{ created_by: session.user.id }, { assigned_to: session.user.id }],
  }
}

export function companyRowScope(session: Session | null) {
  if (!session?.user?.id || isCrmAdmin(session)) return {}
  return {
    OR: [{ created_by: session.user.id }, { assigned_to: session.user.id }],
  }
}

export function dealRowScope(session: Session | null) {
  if (!session?.user?.id || isCrmAdmin(session)) return {}
  return {
    OR: [{ created_by: session.user.id }, { ownerId: session.user.id }],
  }
}

/** Notes/interactions visible to USER: only rows linked to CRM entities they can see. */
export async function crmNotesWhereForSession(
  session: Session,
  workspaceIds: string[]
): Promise<CrmFeedListWhere | null> {
  if (isCrmAdmin(session)) {
    return { workspaceId: { in: workspaceIds } }
  }
  const [contacts, companies, deals] = await Promise.all([
    prisma.contact.findMany({
      where: { workspaceId: { in: workspaceIds }, ...contactRowScope(session) },
      select: { id: true },
    }),
    prisma.company.findMany({
      where: { workspaceId: { in: workspaceIds }, ...companyRowScope(session) },
      select: { id: true },
    }),
    prisma.deal.findMany({
      where: { workspaceId: { in: workspaceIds }, ...dealRowScope(session) },
      select: { id: true },
    }),
  ])
  const cids = contacts.map((c) => c.id)
  const gids = companies.map((c) => c.id)
  const dids = deals.map((c) => c.id)
  if (cids.length === 0 && gids.length === 0 && dids.length === 0) {
    return null
  }
  const or: NonNullable<Prisma.CRMNoteWhereInput['OR']> = [
    ...(cids.length > 0 ? [{ contactId: { in: cids } }] : []),
    ...(gids.length > 0 ? [{ companyId: { in: gids } }] : []),
    ...(dids.length > 0 ? [{ dealId: { in: dids } }] : []),
  ]
  return {
    workspaceId: { in: workspaceIds },
    OR: or,
  }
}

type CrmLinkFields = {
  contactId: string | null
  companyId: string | null
  dealId: string | null
  taskId: string | null
  authorId: string
}

/** Single CRM note / interaction row: can this session read or delete it? */
export async function canAccessCrmLinkedRow(
  session: Session,
  row: CrmLinkFields
): Promise<boolean> {
  if (!session.user?.id) return false
  if (isCrmAdmin(session)) return true
  if (row.authorId === session.user.id) return true

  const checks: Promise<boolean>[] = []
  if (row.contactId) {
    checks.push(
      prisma.contact
        .findFirst({
          where: { id: row.contactId, ...contactRowScope(session) },
          select: { id: true },
        })
        .then(Boolean)
    )
  }
  if (row.companyId) {
    checks.push(
      prisma.company
        .findFirst({
          where: { id: row.companyId, ...companyRowScope(session) },
          select: { id: true },
        })
        .then(Boolean)
    )
  }
  if (row.dealId) {
    checks.push(
      prisma.deal
        .findFirst({
          where: { id: row.dealId, ...dealRowScope(session) },
          select: { id: true },
        })
        .then(Boolean)
    )
  }
  if (checks.length === 0) return false
  const results = await Promise.all(checks)
  return results.some(Boolean)
}
