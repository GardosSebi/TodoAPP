import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
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

  const contactsRaw = workspaceIds.length
    ? await (prisma as any).contact.findMany({
        where: { workspaceId: { in: workspaceIds } },
        include: {
          company: {
            select: { id: true, name: true },
          },
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

  const contacts = contactsRaw.map((contact: any) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    phone: contact.phone,
    status: contact.status,
    company: contact.company
      ? {
          id: contact.company.id,
          name: contact.company.name,
        }
      : null,
  }))

  const companies = companiesRaw.map((company: any) => ({
    id: company.id,
    name: company.name,
  }))

  return (
    <ContactsClient initialContacts={contacts} companies={companies} />
  )
}
