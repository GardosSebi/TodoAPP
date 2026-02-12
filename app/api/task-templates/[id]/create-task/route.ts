import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createTaskFromTemplateSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId } = createTaskFromTemplateSchema.parse(body)

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

    // Get template
    const template = await prisma.taskTemplate.findFirst({
      where: {
        id,
        workspaceId: { in: workspaceIds },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Verify project access if provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          workspaceId: { in: workspaceIds },
        },
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    // Parse template data
    const subtasks = JSON.parse(template.subtasks || '[]')
    const tagIds = JSON.parse(template.tagIds || '[]')

    // Create task from template
    // Note: responsible is set to null to prevent notifications when creating from template
    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        workspaceId: template.workspaceId,
        projectId: projectId || null,
        title: template.title,
        notes: template.notes,
        priority: template.priority,
        status: 'ACTIVE',
        responsible: null, // Don't set responsible when creating from template to avoid notifications
        archived: false,
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
      } as any,
    })

    // Create subtasks
    if (subtasks.length > 0) {
      await prisma.subTask.createMany({
        data: subtasks.map((subtaskTitle: string, index: number) => ({
          taskId: task.id,
          title: subtaskTitle,
          completed: false,
          order: index,
        })),
      })
    }

    // Add tags
    if (tagIds.length > 0) {
      await Promise.all(
        tagIds.map((tagId: string) =>
          (prisma as any).taskTag
            .create({
              data: {
                taskId: task.id,
                tagId,
              },
            })
            .catch(() => {}) // Ignore errors if tag doesn't exist
        )
      )
    }

    // Ensure no notifications were created for this task
    // Delete any TASK_ASSIGNED notifications for this task that might have been created
    // This is a safety measure in case there's any trigger or other logic creating notifications
    try {
      await prisma.notification.deleteMany({
        where: {
          type: 'TASK_ASSIGNED',
          link: {
            contains: task.id,
          },
        },
      })
    } catch (error) {
      // Ignore errors - this is just a safety measure
    }

    // Fetch complete task with relations
    const completeTask = await prisma.task.findUnique({
      where: { id: task.id },
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

    // Format response
    const formattedTask = {
      ...completeTask,
      due_at: completeTask?.due_at?.toISOString() || null,
      completed_at: completeTask?.completed_at?.toISOString() || null,
      created_at: completeTask?.created_at.toISOString(),
      updated_at: completeTask?.updated_at.toISOString(),
      project: (completeTask as any)?.project
        ? {
            ...(completeTask as any).project,
            created_at: (completeTask as any).project.created_at.toISOString(),
            updated_at: (completeTask as any).project.updated_at.toISOString(),
          }
        : null,
      files: ((completeTask as any)?.files || []).map((file: any) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
      subtasks: ((completeTask as any)?.subtasks || []).map((subtask: any) => ({
        ...subtask,
        created_at: subtask.created_at.toISOString(),
        updated_at: subtask.updated_at.toISOString(),
        completed_at: subtask.completed_at?.toISOString() || null,
      })),
      tags: ((completeTask as any)?.tags || []).map((taskTag: any) => ({
        id: taskTag.tag.id,
        name: taskTag.tag.name,
        color: taskTag.tag.color,
        created_at: taskTag.tag.created_at.toISOString(),
        updated_at: taskTag.tag.updated_at.toISOString(),
      })),
    }

    return NextResponse.json({ task: formattedTask }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

