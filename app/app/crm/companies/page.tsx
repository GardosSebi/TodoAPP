import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CompaniesClient from './CompaniesClient'

export default async function CompaniesPage() {
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

  const companiesRaw = workspaceIds.length
    ? await (prisma as any).company.findMany({
        where: { workspaceId: { in: workspaceIds } },
        include: {
          _count: { select: { contacts: true, deals: true } },
        },
        orderBy: [{ updated_at: 'desc' }],
      })
    : []

  const companies = companiesRaw.map((company: any) => ({
    id: company.id,
    name: company.name,
    website: company.website,
    industry: company.industry,
    size: company.size,
    location: company.location,
    status: company.status,
    _count: {
      contacts: company._count?.contacts || 0,
      deals: company._count?.deals || 0,
    },
  }))

  return (
    <CompaniesClient initialCompanies={companies} />
  )
}
