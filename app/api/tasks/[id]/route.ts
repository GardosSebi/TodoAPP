import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, createTaskAssignedEmail, createTaskCompletedEmail } from '@/lib/email'
import {
  getEmailNotificationSettings,
  shouldDeferEmailForQuietHours,
} from '@/lib/emailNotificationSettings'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  reminder_at: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).max(3).optional(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'NOT_STARTED', 'IN_PROGRESS', 'FINISHED']).optional(),
  responsible: z.string().max(100).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  taskType: z.enum(['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'PROPOSAL', 'ADMIN', 'OTHER']).optional().nullable(),
  archived: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get task and check workspace access
    const task = await (prisma as any).task.findFirst({
      where: {
        id,
      },
      include: {
        workspace: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            members: {
              where: {
                userId: session.user.id,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
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
        contact: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            status: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            stage: true,
            value: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if current user is owner of the task's workspace
    const isTaskWorkspaceOwner = task.workspace.userId === session.user.id

    // Format dates and files for API response
    const formattedTask = {
      ...task,
      due_at: task.due_at?.toISOString() || null,
      reminder_at: task.reminder_at?.toISOString() || null,
      completed_at: task.completed_at?.toISOString() || null,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString(),
      workspace: {
        id: task.workspace.id,
        userId: task.workspace.userId,
        isOwner: isTaskWorkspaceOwner,
        owner: task.workspace.user ? {
          id: task.workspace.user.id,
          name: task.workspace.user.name,
          email: task.workspace.user.email,
        } : null,
      },
      project: task.project
        ? {
            ...task.project,
            created_at: task.project.created_at.toISOString(),
            updated_at: task.project.updated_at.toISOString(),
          }
        : null,
      files: task.files.map((file: any) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
    }

    return NextResponse.json({ task: formattedTask })
  } catch (error) {
    // Error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const data = updateTaskSchema.parse(body)

    // Get task and check workspace access
    const existingTask = await (prisma as any).task.findFirst({
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
        project: {
          select: {
            id: true,
            completed: true,
          },
        },
      },
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if project is completed - block all modifications
    if (existingTask.project?.completed) {
      return NextResponse.json(
        { error: 'Cannot modify tasks in a completed project' },
        { status: 403 }
      )
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = existingTask.userId === session.user.id
    const isWorkspaceOwner = existingTask.workspace.userId === session.user.id
    const isWorkspaceMember = existingTask.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate project access if provided
    if (data.projectId) {
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

      // Check project access
      const isProjectOwner = project.userId === session.user.id
      const isProjectWorkspaceOwner = project.workspace.userId === session.user.id
      const isProjectWorkspaceMember = project.workspace.members.length > 0

      if (!isProjectOwner && !isProjectWorkspaceOwner && !isProjectWorkspaceMember) {
        return NextResponse.json(
          { error: 'Access denied to project' },
          { status: 403 }
        )
      }
    }

    if (data.contactId) {
      const contact = await (prisma as any).contact.findFirst({
        where: {
          id: data.contactId,
          workspaceId: existingTask.workspaceId,
        },
        select: { id: true },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found in workspace' }, { status: 404 })
      }
    }

    if (data.companyId) {
      const company = await (prisma as any).company.findFirst({
        where: {
          id: data.companyId,
          workspaceId: existingTask.workspaceId,
        },
        select: { id: true },
      })
      if (!company) {
        return NextResponse.json({ error: 'Company not found in workspace' }, { status: 404 })
      }
    }

    if (data.dealId) {
      const deal = await (prisma as any).deal.findFirst({
        where: {
          id: data.dealId,
          workspaceId: existingTask.workspaceId,
        },
        select: { id: true },
      })
      if (!deal) {
        return NextResponse.json({ error: 'Deal not found in workspace' }, { status: 404 })
      }
    }

    const updateData: any = {}

    if (data.title !== undefined) {
      updateData.title = data.title.trim()
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null
    }
    if (data.due_at !== undefined) {
      updateData.due_at = data.due_at ? new Date(data.due_at) : null
    }
    if (data.reminder_at !== undefined) {
      updateData.reminder_at = data.reminder_at ? new Date(data.reminder_at) : null
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority
    }
    if (data.projectId !== undefined) {
      updateData.projectId = data.projectId || null
    }
    if (data.contactId !== undefined) {
      updateData.contactId = data.contactId || null
    }
    if (data.companyId !== undefined) {
      updateData.companyId = data.companyId || null
    }
    if (data.dealId !== undefined) {
      updateData.dealId = data.dealId || null
    }
    if (data.taskType !== undefined) {
      updateData.task_type = data.taskType || null
    }
    if (data.status !== undefined) {
      // Map FINISHED to COMPLETED for database
      const dbStatus = data.status === 'FINISHED' ? 'COMPLETED' : data.status
      updateData.status = dbStatus
      
      // Handle completed_at timestamp
      if (dbStatus === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        updateData.completed_at = new Date()
      } else if (dbStatus !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
        updateData.completed_at = null
      }
    }
    if (data.responsible !== undefined) {
      // Any workspace member can assign responsible person
      updateData.responsible = data.responsible?.trim() || null
    }
    if (data.archived !== undefined) {
      updateData.archived = data.archived
    }

    const task = await (prisma as any).task.update({
      where: { id },
      data: updateData,
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
        contact: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            status: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            stage: true,
            value: true,
          },
        },
      },
    })

    // Create notifications and send emails when task is completed
    if (data.status !== undefined && task.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      // Get workspace with all members
      const workspace = await prisma.workspace.findUnique({
        where: { id: existingTask.workspaceId },
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

      // Get all workspace users (owner + members)
      const allWorkspaceUsers: Array<{ id: string; name: string; email: string }> = []
      
      // Add workspace owner
      if (workspace?.user) {
        allWorkspaceUsers.push(workspace.user)
      }
      
      // Add workspace members
      workspace?.members.forEach((member) => {
        if (member.user) {
          allWorkspaceUsers.push(member.user)
        }
      })

      // Filter out the user who completed the task
      const recipients = allWorkspaceUsers.filter((user) => user.id !== session.user.id)

      if (recipients.length > 0) {
        const taskLink = task.projectId ? `/app/project/${task.projectId}?task=${task.id}` : `/app?task=${task.id}`
        const projectName = (task.project as any)?.name || null
        const completerName = session.user.name || session.user.email || 'Cineva'
        const projectInfo = projectName ? ` din proiectul "${projectName}"` : ''

        // Create notifications for all recipients
        const notifications = recipients.map((user) => ({
          userId: user.id,
          type: 'TASK_COMPLETED',
          title: 'Sarcina finalizată',
          message: `${completerName} a finalizat sarcina "${task.title}"${projectInfo}`,
          link: taskLink,
        }))

        await prisma.notification.createMany({
          data: notifications,
        })

        // Send email notifications
        for (const recipient of recipients) {
          if (!recipient.email?.trim()) continue
          const prefs = await getEmailNotificationSettings(recipient.id)
          if (!prefs.taskCompletedEmail || shouldDeferEmailForQuietHours(prefs)) continue
          const emailNotification = createTaskCompletedEmail(
            recipient.name || recipient.email,
            completerName,
            task.title,
            taskLink,
            projectName
          )
          emailNotification.to = recipient.email.trim()
          await sendEmail(emailNotification)
        }
      }
    }

    // Create notification if responsible person was assigned or changed
    if (data.responsible !== undefined && task.responsible && task.responsible !== existingTask.responsible) {
      // Find user by name in workspace members
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: existingTask.workspaceId,
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
        where: { id: existingTask.workspaceId },
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
      const ownerUser = workspace?.user ?? null
      const assignedUser = workspaceMembers.find(
        (m) => m.user.name === task.responsible
      )?.user || (ownerUser?.name === task.responsible ? ownerUser : null)

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
    const formattedTask = {
      ...task,
      due_at: task.due_at?.toISOString() || null,
      reminder_at: task.reminder_at?.toISOString() || null,
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
      files: task.files.map((file: any) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
    }

    // Map COMPLETED back to FINISHED for Kanban board if needed
    const responseTask = {
      ...formattedTask,
      status: task.status === 'COMPLETED' && task.projectId ? 'FINISHED' : task.status,
    }

    return NextResponse.json({ task: responseTask })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get task and check workspace access
    const task = await (prisma as any).task.findFirst({
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
        project: {
          select: {
            id: true,
            completed: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if project is completed - block deletion
    if (task.project?.completed) {
      return NextResponse.json(
        { error: 'Cannot delete tasks in a completed project' },
        { status: 403 }
      )
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    // All of them can delete tasks
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await (prisma as any).task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Error('Error deleting task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

