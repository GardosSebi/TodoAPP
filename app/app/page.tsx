import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import InboxClient from './InboxClient'

export default async function InboxPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: 'ACTIVE',
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

  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      userId: session.user.id,
      status: 'PENDING',
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      inviter: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  return (
    <InboxClient
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
      initialInvitations={invitations.map((inv) => ({
        id: inv.id,
        workspace: inv.workspace,
        inviter: inv.inviter,
        status: inv.status,
        created_at: inv.created_at.toISOString(),
      }))}
    />
  )
}
