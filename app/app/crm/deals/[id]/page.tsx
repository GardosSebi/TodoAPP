import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }

  const { id } = await params
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

  if (!deal) notFound()

  const companies = await (prisma as any).company.findMany({
    where: { workspaceId: deal.workspaceId },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }],
  })
  const contacts = await (prisma as any).contact.findMany({
    where: { workspaceId: deal.workspaceId },
    select: { id: true, first_name: true, last_name: true },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })

  return <DealDetailClient initialDeal={deal} companies={companies} contacts={contacts} />
}
