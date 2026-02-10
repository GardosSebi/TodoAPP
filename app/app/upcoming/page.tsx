import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UpcomingClient from './UpcomingClient'

interface UpcomingPageProps {
  searchParams: Promise<{ days?: string }>
}

export default async function UpcomingPage({ searchParams }: UpcomingPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams
  const days = params.days ? parseInt(params.days, 10) : 7
  const validDays = isNaN(days) || days < 1 ? 7 : days

  // Get workspaces where user is owner or member
  const userWorkspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true },
  })

  const workspaceIds = userWorkspaces.map((w) => w.id)

  // Fetch all projects from accessible workspaces
  const projectsRaw = workspaceIds.length > 0 ? await prisma.project.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      archived: false,
    },
    orderBy: {
      created_at: 'asc',
    },
  }) : []

  // Calculate task counts excluding archived tasks
  const projects = await Promise.all(
    projectsRaw.map(async (project) => {
      const taskCount = await prisma.task.count({
        where: {
          projectId: project.id,
          archived: false,
        },
      })
      return {
        ...project,
        _count: {
          tasks: taskCount,
        },
      }
    })
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Calculate days from today (end of day)
  const daysFromNow = new Date(today)
  daysFromNow.setDate(daysFromNow.getDate() + validDays)
  daysFromNow.setHours(23, 59, 59, 999)

  // Get tasks from all accessible workspaces that are not completed/finished and have due date within the next N days
  const tasks = workspaceIds.length > 0 ? await prisma.task.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      archived: false,
      status: {
        notIn: ['COMPLETED', 'FINISHED'],
      },
      due_at: {
        gte: today,
        lte: daysFromNow,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          userId: true,
          name: true,
          color: true,
          created_at: true,
          updated_at: true,
        },
      },
      files: {
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    } as any,
    orderBy: [
      { priority: 'desc' },
      { due_at: 'asc' },
      { created_at: 'desc' },
    ],
  }) : []

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">Viitoare</h1>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
          Sarcini în următoarele {validDays} {validDays === 1 ? 'zi' : 'zile'} ({tasks.length})
        </p>
      </div>

      <UpcomingClient
        days={validDays}
        projects={projects.map((project: any) => ({
          ...project,
          created_at: project.created_at.toISOString(),
          updated_at: project.updated_at.toISOString(),
        }))}
        tasks={tasks.map((task: any) => ({
          ...task,
          due_at: task.due_at?.toISOString() || null,
          completed_at: task.completed_at?.toISOString() || null,
          created_at: task.created_at.toISOString(),
          updated_at: task.updated_at.toISOString(),
          project: task.project
            ? {
                ...task.project,
                created_at: task.project.created_at.toISOString(),
                updated_at: task.project.updated_at.toISOString(),
              }
            : null,
          files: (task.files || []).map((file: any) => ({
            ...file,
            uploaded_at: file.uploaded_at.toISOString(),
          })),
        }))}
      />
    </div>
  )
}

