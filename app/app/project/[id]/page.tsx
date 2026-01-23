import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProjectClient from './ProjectClient'
import { notFound } from 'next/navigation'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params

  // Check if user has access to project (owner or workspace member)
  const project = await prisma.project.findFirst({
    where: {
      id,
    },
    include: {
      workspace: {
        select: {
          id: true,
          userId: true,
          members: {
            where: {
              userId: session.user.id,
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Check access: user is project owner OR workspace owner OR workspace member
  const isProjectOwner = project.userId === session.user.id
  const isWorkspaceOwner = project.workspace.userId === session.user.id
  const isWorkspaceMember = project.workspace.members.length > 0

  if (!isProjectOwner && !isWorkspaceOwner && !isWorkspaceMember) {
    notFound()
  }

  // Get all tasks in this project (workspace members can see all tasks)
  const tasks = await prisma.task.findMany({
    where: {
      projectId: id,
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
    orderBy: [
      { priority: 'desc' },
      { due_at: 'asc' },
      { created_at: 'desc' },
    ],
  })

  return (
    <ProjectClient
      initialTasks={tasks.map((task: any) => ({
        ...task,
        // Map status for Kanban board: COMPLETED -> FINISHED, ACTIVE without status -> NOT_STARTED
        status: task.status === 'COMPLETED' 
          ? 'FINISHED' 
          : task.status === 'ACTIVE' && !task.completed_at
            ? 'NOT_STARTED'
            : task.status,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
        files: (task.files || []).map((file: any) => ({
          ...file,
          uploaded_at: file.uploaded_at.toISOString(),
        })),
      }))}
      projectId={id}
      projectName={project.name}
    />
  )
}

