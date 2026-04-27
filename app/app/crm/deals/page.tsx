import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DealsClient from './DealsClient'

export default async function DealsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  const userWorkspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
    select: { id: true },
  })
  const workspaceIds = userWorkspaces.map((w) => w.id)

  const dealsRaw = workspaceIds.length
    ? await (prisma as any).deal.findMany({
        where: { workspaceId: { in: workspaceIds } },
        include: {
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true } },
        },
        orderBy: [{ updated_at: 'desc' }],
      })
    : []

  const companiesRaw = workspaceIds.length
    ? await (prisma as any).company.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }],
      })
    : []

  const contactsRaw = workspaceIds.length
    ? await (prisma as any).contact.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { id: true, first_name: true, last_name: true },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      })
    : []

  const deals = dealsRaw.map((deal: any) => ({
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    value: deal.value,
    company: deal.company
      ? {
          id: deal.company.id,
          name: deal.company.name,
        }
      : null,
    contact: deal.contact
      ? {
          id: deal.contact.id,
          first_name: deal.contact.first_name,
          last_name: deal.contact.last_name,
        }
      : null,
  }))

  const companies = companiesRaw.map((company: any) => ({
    id: company.id,
    name: company.name,
  }))

  const contacts = contactsRaw.map((contact: any) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
  }))

  return (
    <DealsClient initialDeals={deals} companies={companies} contacts={contacts} />
  )
}
