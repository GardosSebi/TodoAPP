import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, createTaskAssignedEmail } from '@/lib/email'
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(3),
  projectId: z.string().uuid().optional().nullable(),
  responsible: z.string().max(100).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const view = searchParams.get('view') // 'today', 'upcoming', 'completed'
    const search = searchParams.get('search') // Search query
    const priority = searchParams.get('priority') // Priority filter
    const responsible = searchParams.get('responsible') // Responsible person filter
    const dateFrom = searchParams.get('dateFrom') // Date range start
    const dateTo = searchParams.get('dateTo') // Date range end
    const tagIds = searchParams.get('tagIds') // Comma-separated tag IDs
    const includeArchived = searchParams.get('includeArchived') === 'true' // Include archived tasks

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
      return NextResponse.json({ tasks: [] })
    }

    // Get user's accessible project IDs (owned or shared) in accessible workspaces
    const accessibleProjects = await prisma.project.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        OR: [
          { userId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    })
    const accessibleProjectIds = accessibleProjects.map((p) => p.id)

    // Workspace members can see all tasks in accessible workspaces
    const where: any = {
      workspaceId: { in: workspaceIds },
    }

    // Exclude archived tasks by default unless explicitly requested
    if (!includeArchived) {
      where.archived = false
    }

    if (status) {
      where.status = status
    }

    if (projectId) {
      // Verify user has access to this project
      if (!accessibleProjectIds.includes(projectId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      where.projectId = projectId
    }

    if (view === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      where.due_at = {
        gte: today,
        lt: tomorrow,
      }
      where.status = 'ACTIVE'
    } else if (view === 'upcoming') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      where.due_at = {
        gt: today,
      }
      where.status = 'ACTIVE'
    } else if (view === 'completed') {
      where.status = 'COMPLETED'
    }

    // Advanced filters
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (priority) {
      where.priority = parseInt(priority)
    }

    if (responsible) {
      where.responsible = { contains: responsible, mode: 'insensitive' }
    }

    if (dateFrom || dateTo) {
      where.due_at = {}
      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        where.due_at.gte = fromDate
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        where.due_at.lte = toDate
      }
    }

    // Filter by tags
    if (tagIds) {
      const tagIdArray = tagIds.split(',').filter((id) => id.trim())
      if (tagIdArray.length > 0) {
        where.tags = {
          some: {
            tagId: { in: tagIdArray },
          },
        }
      }
    }

    const tasks = await prisma.task.findMany({
      where,
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
        subtasks: {
          orderBy: [
            { order: 'asc' },
            { created_at: 'asc' },
          ],
        },
        tags: {
          include: {
            tag: true,
          },
        },
      } as any,
      orderBy: [
        { priority: 'desc' },
        { due_at: 'asc' },
        { created_at: 'desc' },
      ],
    })

    // Format dates for API response
    const formattedTasks = tasks.map((task: any) => ({
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
      subtasks: (task.subtasks || []).map((subtask: any) => ({
        ...subtask,
        created_at: subtask.created_at.toISOString(),
        updated_at: subtask.updated_at.toISOString(),
        completed_at: subtask.completed_at?.toISOString() || null,
      })),
      tags: (task.tags || []).map((taskTag: any) => ({
        id: taskTag.tag.id,
        name: taskTag.tag.name,
        color: taskTag.tag.color,
        created_at: taskTag.tag.created_at.toISOString(),
        updated_at: taskTag.tag.updated_at.toISOString(),
      })),
    }))

    return NextResponse.json({ tasks: formattedTasks })
  } catch (error) {
    // Error fetching tasks
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = taskSchema.parse(body)

    // Determine workspaceId - use project's workspace if project is provided, otherwise user's workspace
    let targetWorkspaceId: string | null = null

    if (data.projectId) {
      // Validate project access and get its workspace
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
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
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }

      // Check project access: user is project owner OR workspace owner OR workspace member
      const isProjectOwner = project.userId === session.user.id
      const isWorkspaceOwner = project.workspace.userId === session.user.id
      const isWorkspaceMember = project.workspace.members.length > 0

      if (!isProjectOwner && !isWorkspaceOwner && !isWorkspaceMember) {
        return NextResponse.json(
          { error: 'Access denied to project' },
          { status: 403 }
        )
      }

      targetWorkspaceId = project.workspace.id
    } else {
      // Get user's workspace for standalone tasks
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { workspaceId: true },
      })

      if (!user?.workspaceId) {
        return NextResponse.json(
          { error: 'User workspace not found' },
          { status: 404 }
        )
      }

      targetWorkspaceId = user.workspaceId
    }

    // Check if user is workspace owner (only owner can assign responsible)
    let canAssignResponsible = false
    if (data.responsible) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: targetWorkspaceId },
        select: { userId: true },
      })
      canAssignResponsible = workspace?.userId === session.user.id
      
      if (!canAssignResponsible) {
        return NextResponse.json(
          { error: 'Only workspace owner can assign responsible person' },
          { status: 403 }
        )
      }
    }

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        workspaceId: targetWorkspaceId,
        title: data.title.trim(),
        notes: data.notes?.trim() || null,
        due_at: data.due_at ? new Date(data.due_at) : null,
        priority: data.priority,
        projectId: data.projectId || null,
        responsible: canAssignResponsible ? (data.responsible?.trim() || null) : null,
        status: data.projectId ? 'NOT_STARTED' : 'ACTIVE', // Default to NOT_STARTED for project tasks
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
        subtasks: {
          orderBy: [
            { order: 'asc' },
            { created_at: 'asc' },
          ],
        },
        tags: {
          include: {
            tag: true,
          },
        },
      } as any,
    })

    // Create notification if responsible person is assigned
    if (task.responsible) {
      // Find user by name in workspace members
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: targetWorkspaceId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Also check workspace owner
      const workspace = await prisma.workspace.findUnique({
        where: { id: targetWorkspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Find the user with matching name
      const assignedUser = workspaceMembers.find(
        (m) => m.user.name === task.responsible
      )?.user || (workspace?.user?.name === task.responsible ? workspace.user : null)

      if (assignedUser && assignedUser.id !== session.user.id) {
        const taskLink = task.projectId ? `/app/project/${task.projectId}?task=${task.id}` : `/app?task=${task.id}`
        const projectName = (task.project as any)?.name || null
        const projectInfo = projectName ? ` din proiectul "${projectName}"` : ''
        
        // Create notification for the assigned user
        await prisma.notification.create({
          data: {
            userId: assignedUser.id,
            type: 'TASK_ASSIGNED',
            title: 'Ai fost atribuit la o sarcină',
            message: `${session.user.name || session.user.email} te-a atribuit la sarcina "${task.title}"${projectInfo}`,
            link: taskLink,
          },
        })

        // Send email notification
        if (assignedUser.email) {
          const emailNotification = createTaskAssignedEmail(
            assignedUser.name || assignedUser.email,
            session.user.name || session.user.email || 'Cineva',
            task.title,
            taskLink,
            projectName
          )
          emailNotification.to = assignedUser.email
          await sendEmail(emailNotification)
        }
      }
    }

    // Format dates and files for API response
    const taskWithFiles = task as any
    const formattedTask = {
      ...task,
      due_at: task.due_at?.toISOString() || null,
      completed_at: task.completed_at?.toISOString() || null,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString(),
      project: taskWithFiles.project
        ? {
            ...taskWithFiles.project,
            created_at: taskWithFiles.project.created_at.toISOString(),
            updated_at: taskWithFiles.project.updated_at.toISOString(),
          }
        : null,
      files: (taskWithFiles.files || []).map((file: any) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
      subtasks: (taskWithFiles.subtasks || []).map((subtask: any) => ({
        ...subtask,
        created_at: subtask.created_at.toISOString(),
        updated_at: subtask.updated_at.toISOString(),
        completed_at: subtask.completed_at?.toISOString() || null,
      })),
      tags: (taskWithFiles.tags || []).map((taskTag: any) => ({
        id: taskTag.tag.id,
        name: taskTag.tag.name,
        color: taskTag.tag.color,
        created_at: taskTag.tag.created_at.toISOString(),
        updated_at: taskTag.tag.updated_at.toISOString(),
      })),
    }

    return NextResponse.json({ task: formattedTask }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error creating task
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

