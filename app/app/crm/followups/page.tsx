import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams?: Promise<{ window?: string; entity?: string }>
}) {
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

  const tasks = workspaceIds.length
    ? await (prisma as any).task.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          status: {
            in: ['ACTIVE', 'NOT_STARTED', 'IN_PROGRESS'],
          },
          reminder_at: { not: null },
        },
        include: {
          project: { select: { id: true, name: true } },
          contact: { select: { id: true, first_name: true, last_name: true } },
          company: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
        orderBy: [{ reminder_at: 'asc' }],
      })
    : []

  const params = searchParams ? await searchParams : {}
  const windowFilter = params?.window || 'all'
  const entityFilter = params?.entity || 'all'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfToday = new Date(today)
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)

  const windowed = tasks.filter((task: any) => {
    if (!task.reminder_at) return false
    const reminder = new Date(task.reminder_at)
    if (windowFilter === 'today') return reminder >= today && reminder <= endOfToday
    if (windowFilter === 'week') return reminder >= today && reminder <= endOfWeek
    if (windowFilter === 'overdue') return reminder < today
    return true
  })

  const filtered = windowed.filter((task: any) => {
    if (entityFilter === 'contact') return Boolean(task.contact)
    if (entityFilter === 'company') return Boolean(task.company)
    if (entityFilter === 'deal') return Boolean(task.deal)
    return true
  })

  const overdue = filtered.filter((task: any) => task.reminder_at && new Date(task.reminder_at) < today)
  const upcoming = filtered.filter((task: any) => task.reminder_at && new Date(task.reminder_at) >= today)

  const renderTask = (task: any) => (
    <div key={task.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Reminder la: {new Date(task.reminder_at).toLocaleDateString('ro-RO')}
          </p>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            {task.contact && <p>Contact: {task.contact.first_name} {task.contact.last_name}</p>}
            {task.company && <p>Companie: {task.company.name}</p>}
            {task.deal && <p>Oportunitate: {task.deal.title}</p>}
            {task.project && <p>Proiect: {task.project.name}</p>}
          </div>
        </div>
        <Link
          href={task.projectId ? `/app/project/${task.projectId}?task=${task.id}` : `/app?task=${task.id}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Deschide
        </Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Follow-up-uri</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {filtered.length} task-uri cu reminder
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Toate' },
          { key: 'today', label: 'Azi' },
          { key: 'week', label: '7 zile' },
          { key: 'overdue', label: 'Întârziate' },
        ].map((item) => (
          <Link
            key={item.key}
            href={`/app/crm/followups?window=${item.key}&entity=${entityFilter}`}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              windowFilter === item.key
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Toate entitățile' },
          { key: 'contact', label: 'Contacte' },
          { key: 'company', label: 'Companii' },
          { key: 'deal', label: 'Oportunități' },
        ].map((item) => (
          <Link
            key={item.key}
            href={`/app/crm/followups?window=${windowFilter}&entity=${item.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              entityFilter === item.key
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-3">Întârziate ({overdue.length})</h2>
          <div className="space-y-3">
            {overdue.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nu există follow-up-uri întârziate.</p>
            )}
            {overdue.map(renderTask)}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Următoarele ({upcoming.length})</h2>
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nu există follow-up-uri planificate.</p>
            )}
            {upcoming.map(renderTask)}
          </div>
        </div>
      </div>
    </div>
  )
}
