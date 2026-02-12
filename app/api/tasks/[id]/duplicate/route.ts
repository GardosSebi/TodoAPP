import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { z } from 'zod'

const duplicateSchema = z.object({
  includeSubtasks: z.boolean().optional().default(true),
  includeFiles: z.boolean().optional().default(true),
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
    const { includeSubtasks, includeFiles } = duplicateSchema.parse(body)

    // Get the original task with all related data
    const originalTask = await prisma.task.findFirst({
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
            name: true,
            color: true,
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
        files: true,
      } as any,
    })

    if (!originalTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = originalTask.userId === session.user.id
    const workspace = originalTask.workspace as any
    const isWorkspaceOwner = workspace?.userId === session.user.id
    const isWorkspaceMember = workspace?.members?.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create the duplicated task
    const duplicatedTask = await prisma.task.create({
      data: {
        userId: session.user.id,
        workspaceId: originalTask.workspaceId,
        projectId: originalTask.projectId,
        title: `${originalTask.title} (Copie)`,
        notes: originalTask.notes,
        due_at: originalTask.due_at,
        priority: originalTask.priority,
        status: 'ACTIVE', // Reset status to ACTIVE for the duplicate
        responsible: originalTask.responsible,
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

    // Copy subtasks if requested
    if (includeSubtasks && originalTask.subtasks && originalTask.subtasks.length > 0) {
      await prisma.subTask.createMany({
        data: originalTask.subtasks.map((subtask: any) => ({
          taskId: duplicatedTask.id,
          title: subtask.title,
          completed: false, // Reset completed status
          order: subtask.order,
        })),
      })
    }

    // Copy tags
    if (originalTask.tags && originalTask.tags.length > 0) {
      const tagIds = originalTask.tags.map((taskTag: any) => taskTag.tagId || taskTag.tag?.id).filter(Boolean)
      if (tagIds.length > 0) {
        await Promise.all(
          tagIds.map((tagId: string) =>
            (prisma as any).taskTag.create({
              data: {
                taskId: duplicatedTask.id,
                tagId,
              },
            }).catch(() => {}) // Ignore errors if tag doesn't exist
          )
        )
      }
    }

    // Copy files if requested
    if (includeFiles && originalTask.files && originalTask.files.length > 0) {
      const sourceDir = join(process.cwd(), 'public', 'uploads', 'tasks', id)
      const targetDir = join(process.cwd(), 'public', 'uploads', 'tasks', duplicatedTask.id)

      // Create target directory if it doesn't exist
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true })
      }

      for (const file of originalTask.files) {
        try {
          const fileData = file as any
          const sourcePath = join(process.cwd(), 'public', fileData.filePath)
          const timestamp = Date.now()
          const sanitizedFileName = fileData.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
          const newFileName = `${timestamp}_${sanitizedFileName}`
          const targetPath = join(targetDir, newFileName)
          const newRelativePath = `/uploads/tasks/${duplicatedTask.id}/${newFileName}`

          // Copy the file if it exists
          if (existsSync(sourcePath)) {
            const fileContent = await readFile(sourcePath)
            await writeFile(targetPath, fileContent)

            // Create new file record
            await (prisma as any).taskFile.create({
              data: {
                taskId: duplicatedTask.id,
                fileName: fileData.fileName,
                filePath: newRelativePath,
                fileSize: fileData.fileSize,
                mimeType: fileData.mimeType,
              },
            })
          }
        } catch (fileError) {
          // Continue with other files if one fails
        }
      }
    }

    // Fetch the complete duplicated task with all relations
    const completeDuplicatedTask = await prisma.task.findUnique({
      where: { id: duplicatedTask.id },
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
      ...completeDuplicatedTask,
      due_at: completeDuplicatedTask?.due_at?.toISOString() || null,
      completed_at: completeDuplicatedTask?.completed_at?.toISOString() || null,
      created_at: completeDuplicatedTask?.created_at.toISOString(),
      updated_at: completeDuplicatedTask?.updated_at.toISOString(),
      project: (completeDuplicatedTask as any)?.project
        ? {
            ...(completeDuplicatedTask as any).project,
            created_at: (completeDuplicatedTask as any).project.created_at.toISOString(),
            updated_at: (completeDuplicatedTask as any).project.updated_at.toISOString(),
          }
        : null,
      files: ((completeDuplicatedTask as any)?.files || []).map((file: any) => ({
        ...file,
        uploaded_at: file.uploaded_at.toISOString(),
      })),
      subtasks: ((completeDuplicatedTask as any)?.subtasks || []).map((subtask: any) => ({
        ...subtask,
        created_at: subtask.created_at.toISOString(),
        updated_at: subtask.updated_at.toISOString(),
        completed_at: subtask.completed_at?.toISOString() || null,
      })),
      tags: ((completeDuplicatedTask as any)?.tags || []).map((taskTag: any) => ({
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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

