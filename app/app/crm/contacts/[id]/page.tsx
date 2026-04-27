import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

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

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link href="/app/crm/contacts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Inapoi la contacts
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          {contact.first_name} {contact.last_name}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{contact.job_title || 'Fara job title'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Detalii</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Email: {contact.email || '-'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Telefon: {contact.phone || '-'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Status: {contact.status}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Companie: {contact.company ? contact.company.name : '-'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Deals</h2>
          <div className="space-y-2">
            {contact.deals.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Fără deals</p>}
            {contact.deals.map((deal: any) => (
              <div key={deal.id} className="text-sm text-gray-700 dark:text-gray-300">
                {deal.title} - {deal.stage}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Task-uri asociate</h2>
        <div className="space-y-2">
          {contact.tasks.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Fără task-uri</p>}
          {contact.tasks.map((task: any) => (
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
