import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'phc-argon2'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  sendInvitation: z.boolean().default(false),
})

// Generate a random password
function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            tasks: true,
            projects: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    // Error('Error fetching users:', error)
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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const data = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Generate password if not provided
    let password = data.password
    if (!password || data.sendInvitation) {
      password = generateRandomPassword()
    }

    const password_hash = await hash(password)

    // Create workspace and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create workspace first
      const workspace = await tx.workspace.create({
        data: {
          name: `${data.email.split('@')[0]}'s Workspace`, // Use email prefix as name
        },
      })

      // Create user with workspace
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          password_hash,
          role: 'USER',
          workspaceId: workspace.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          created_at: true,
        },
      })

      // Update workspace with userId
      await tx.workspace.update({
        where: { id: workspace.id },
        data: { userId: newUser.id },
      })

      return newUser
    })

    const newUser = result

    // In a real app, you would send an email invitation here
    // For now, we'll return the password if sendInvitation is true
    const response: any = {
      user: newUser,
      message: 'User created successfully',
    }

    if (data.sendInvitation) {
      response.temporaryPassword = password
      response.message = 'User created successfully. Temporary password generated.'
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

