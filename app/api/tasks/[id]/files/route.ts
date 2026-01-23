import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params

    // Verify task exists and user has access (owner or workspace member)
    const task = await prisma.task.findFirst({
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

    if (!task) {
      return NextResponse.json({ error: 'Sarcina nu a fost găsită' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nu a fost selectat niciun fișier' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Fișierul este prea mare (max 10MB)' }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'tasks', id)
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${sanitizedFileName}`
    const filePath = join(uploadsDir, fileName)
    const relativePath = `/uploads/tasks/${id}/${fileName}`

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Save file record to database
    try {
      const taskFile = await (prisma as any).taskFile.create({
        data: {
          taskId: id,
          fileName: file.name,
          filePath: relativePath,
          fileSize: file.size,
          mimeType: file.type,
        },
      })

      return NextResponse.json({ 
        file: {
          ...taskFile,
          uploaded_at: taskFile.uploaded_at.toISOString(),
        }
      }, { status: 201 })
    } catch (dbError: any) {
      // If TaskFile model doesn't exist, delete the uploaded file
      const filePath = join(process.cwd(), 'public', relativePath)
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {})
      }
      
      if (dbError.code === 'P2001' || dbError.message?.includes('taskFile')) {
        return NextResponse.json(
          { error: 'Modelul TaskFile nu există. Te rog rulează: npm run db:generate && npm run db:push' },
          { status: 500 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    // Error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Eroare la încărcarea fișierului' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params

    // Verify task exists and user has access (owner or workspace member)
    const task = await prisma.task.findFirst({
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

    if (!task) {
      return NextResponse.json({ error: 'Sarcina nu a fost găsită' }, { status: 404 })
    }

    // Check access: user is task owner OR workspace owner OR workspace member
    const isTaskOwner = task.userId === session.user.id
    const isWorkspaceOwner = task.workspace.userId === session.user.id
    const isWorkspaceMember = task.workspace.members.length > 0

    if (!isTaskOwner && !isWorkspaceOwner && !isWorkspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all files for this task
    try {
      const files = await (prisma as any).taskFile.findMany({
        where: {
          taskId: id,
        },
        orderBy: {
          uploaded_at: 'desc',
        },
      })

      return NextResponse.json({ 
        files: files.map((file: any) => ({
          ...file,
          uploaded_at: file.uploaded_at.toISOString(),
        }))
      })
    } catch (error: any) {
      // If TaskFile model doesn't exist yet, return empty array
      if (error.message?.includes('taskFile') || error.code === 'P2001') {
        return NextResponse.json({ files: [] })
      }
      throw error
    }
  } catch (error) {
    // Error('Error fetching files:', error)
    return NextResponse.json(
      { error: 'Eroare la preluarea fișierelor' },
      { status: 500 }
    )
  }
}

