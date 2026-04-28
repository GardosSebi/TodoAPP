import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all', 'tasks', 'projects', 'contacts', 'companies', 'deals'

    if (!query.trim()) {
      return NextResponse.json({ tasks: [], projects: [], contacts: [], companies: [], deals: [] })
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

    if (workspaceIds.length === 0) {
      return NextResponse.json({ tasks: [], projects: [], contacts: [], companies: [], deals: [] })
    }

    const results: { tasks: any[]; projects: any[]; contacts: any[]; companies: any[]; deals: any[] } = {
      tasks: [],
      projects: [],
      contacts: [],
      companies: [],
      deals: [],
    }

    // Search tasks
    if (type === 'all' || type === 'tasks') {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        take: 50,
        orderBy: [
          { priority: 'desc' },
          { due_at: 'asc' },
        ],
      })

      results.tasks = tasks.map((task: any) => ({
        ...task,
        due_at: task.due_at?.toISOString() || null,
        completed_at: task.completed_at?.toISOString() || null,
        created_at: task.created_at.toISOString(),
        updated_at: task.updated_at.toISOString(),
      }))
    }

    // Search projects
    if (type === 'all' || type === 'projects') {
      const projectsRaw = await prisma.project.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          archived: false,
          OR: [
            { userId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
          name: { contains: query, mode: 'insensitive' },
        },
        take: 20,
        orderBy: { name: 'asc' },
      })

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

      results.projects = projects.map((project: any) => ({
        ...project,
        created_at: project.created_at.toISOString(),
        updated_at: project.updated_at.toISOString(),
        taskCount: project._count.tasks,
      }))
    }

    // Search contacts
    if (type === 'all' || type === 'contacts') {
      const contacts = await (prisma as any).contact.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { first_name: { contains: query, mode: 'insensitive' } },
            { last_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
        take: 50,
        orderBy: [{ updated_at: 'desc' }],
      })

      results.contacts = contacts.map((contact: any) => ({
        ...contact,
        created_at: contact.created_at.toISOString(),
        updated_at: contact.updated_at.toISOString(),
      }))
    }

    // Search companies
    if (type === 'all' || type === 'companies') {
      const companies = await (prisma as any).company.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { website: { contains: query, mode: 'insensitive' } },
            { industry: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 30,
        orderBy: [{ updated_at: 'desc' }],
      })

      results.companies = companies.map((company: any) => ({
        ...company,
        created_at: company.created_at.toISOString(),
        updated_at: company.updated_at.toISOString(),
      }))
    }

    // Search deals
    if (type === 'all' || type === 'deals') {
      const deals = await (prisma as any).deal.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          company: {
            select: { id: true, name: true },
          },
          contact: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
        take: 30,
        orderBy: [{ updated_at: 'desc' }],
      })

      results.deals = deals.map((deal: any) => ({
        ...deal,
        expected_close: deal.expected_close?.toISOString() || null,
        created_at: deal.created_at.toISOString(),
        updated_at: deal.updated_at.toISOString(),
      }))
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

