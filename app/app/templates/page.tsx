import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TemplatesClient from './TemplatesClient'

export default async function TemplatesPage() {
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

  // Fetch templates
  const templates = workspaceIds.length > 0 ? await prisma.taskTemplate.findMany({
    where: {
      workspaceId: { in: workspaceIds },
    },
    orderBy: {
      created_at: 'desc',
    },
  }) : []

  // Fetch projects for dropdown
  const projects = workspaceIds.length > 0 ? await prisma.project.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      archived: false,
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: {
      created_at: 'asc',
    },
  }) : []

  // Fetch tags for dropdown
  const tags = workspaceIds.length > 0 ? await prisma.tag.findMany({
    where: {
      workspaceId: { in: workspaceIds },
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: {
      name: 'asc',
    },
  }) : []

  // Fetch workspace users (owners + members) for responsible dropdown
  const workspaceUsers: Array<{ id: string; name: string; email: string }> = []
  
  if (workspaceIds.length > 0) {
    // Get all workspaces with owners and members
    const workspaces = await prisma.workspace.findMany({
      where: {
        id: { in: workspaceIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    // Collect all unique users (owners + members)
    const userIds = new Set<string>()
    for (const workspace of workspaces) {
      // Add owner
      if (workspace.user && !userIds.has(workspace.user.id)) {
        userIds.add(workspace.user.id)
        workspaceUsers.push({
          id: workspace.user.id,
          name: workspace.user.name || workspace.user.email,
          email: workspace.user.email,
        })
      }
      
      // Add members
      for (const member of workspace.members) {
        if (member.user && !userIds.has(member.user.id)) {
          userIds.add(member.user.id)
          workspaceUsers.push({
            id: member.user.id,
            name: member.user.name || member.user.email,
            email: member.user.email,
          })
        }
      }
    }
  }

  // Format templates
  const formattedTemplates = templates.map((template) => ({
    ...template,
    subtasks: JSON.parse(template.subtasks || '[]'),
    tagIds: JSON.parse(template.tagIds || '[]'),
    created_at: template.created_at.toISOString(),
    updated_at: template.updated_at.toISOString(),
  }))

  return (
    <TemplatesClient
      initialTemplates={formattedTemplates}
      projects={projects}
      tags={tags}
      workspaceUsers={workspaceUsers}
    />
  )
}

