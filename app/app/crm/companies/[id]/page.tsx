import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CompanyDetailClient from './CompanyDetailClient'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params
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
        take: 20,
      },
      tasks: {
        orderBy: [{ created_at: 'desc' }],
        take: 20,
      },
    },
  })

  if (!company) notFound()

  const contacts = await (prisma as any).contact.findMany({
    where: { workspaceId: company.workspaceId },
    select: { id: true, first_name: true, last_name: true },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })

  return <CompanyDetailClient initialCompany={company} contacts={contacts} />
}
