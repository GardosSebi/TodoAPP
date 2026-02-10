import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ArchivedClient from './ArchivedClient'

export default async function ArchivedPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

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

  // Fetch archived tasks
  const tasks = workspaceIds.length > 0 ? await prisma.task.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      archived: true,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      files: {
        orderBy: {
          uploaded_at: 'desc',
        },
      },
    } as any,
    orderBy: {
      updated_at: 'desc',
    },
  }) : []

  // Fetch archived projects
  const projects = workspaceIds.length > 0 ? await prisma.project.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      archived: true,
    },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      updated_at: 'desc',
    },
  }) : []

  return (
    <ArchivedClient
      initialTasks={tasks.map((task: any) => ({
        ...task,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
        files: (task.files || []).map((file: any) => ({
          ...file,
          uploaded_at: file.uploaded_at.toISOString(),
        })),
      }))}
      initialProjects={projects.map((project: any) => ({
        ...project,
        created_at: project.created_at.toISOString(),
        updated_at: project.updated_at.toISOString(),
      }))}
    />
  )
}


