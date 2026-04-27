import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

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

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link href="/app/crm/deals" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Înapoi la oportunități
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{deal.title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{deal.stage}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Detalii</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Valoare: {deal.value} EUR</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Companie: {deal.company ? deal.company.name : '-'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Contact: {deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : '-'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Dată estimată închidere: {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString('ro-RO') : '-'}
          </p>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Task-uri asociate</h2>
        <div className="space-y-2">
          {deal.tasks.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Fără task-uri</p>}
          {deal.tasks.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{task.title}</span>
              <span className="text-gray-500 dark:text-gray-400">{task.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
