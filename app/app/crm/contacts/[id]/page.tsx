import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ContactDetailClient from './ContactDetailClient'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params
  const contact = await (prisma as any).contact.findFirst({
    where: {
      id,
      workspace: {
        OR: [{ userId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
    },
    include: {
      company: true,
      tasks: {
        orderBy: [{ created_at: 'desc' }],
        take: 20,
      },
      deals: {
        orderBy: [{ updated_at: 'desc' }],
        take: 20,
      },
    },
  })

  if (!contact) notFound()

  const companies = await (prisma as any).company.findMany({
    where: { workspaceId: contact.workspaceId },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }],
  })

  return <ContactDetailClient initialContact={contact} companies={companies} />
}
