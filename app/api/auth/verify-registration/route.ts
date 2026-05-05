import { NextRequest, NextResponse } from 'next/server'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPasswordResetToken } from '@/lib/password-reset-token'

const bodySchema = z.object({
  token: z.string().min(1),
})

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { token: rawToken } = bodySchema.parse(json)
    const tokenHash = hashPasswordResetToken(rawToken.trim())

    const pending = await prisma.pendingRegistration.findUnique({
      where: { token_hash: tokenHash },
    })

    if (!pending) {
      return NextResponse.json({ error: 'Link invalid sau expirat.' }, { status: 400 })
    }

    if (pending.expires_at.getTime() < Date.now()) {
      await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {})
      return NextResponse.json({ error: 'Link expirat. Înregistrează-te din nou.' }, { status: 400 })
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: pending.email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existing) {
      await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {})
      return NextResponse.json(
        { error: 'Există deja un cont cu acest email. Te poți conecta.' },
        { status: 400 }
      )
    }

    const user = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: `${pending.name.trim()}'s Workspace` },
      })

      const u = await tx.user.create({
        data: {
          email: pending.email,
          name: pending.name.trim(),
          password_hash: pending.password_hash,
          role: UserRole.USER,
          workspaceId: workspace.id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          created_at: true,
        },
      })

      await tx.workspace.update({
        where: { id: workspace.id },
        data: { userId: u.id },
      })

      await tx.pendingRegistration.delete({ where: { id: pending.id } })

      return u
    })

    return NextResponse.json({ user, message: 'Cont activat.' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Există deja un cont cu acest email. Te poți conecta.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Eroare internă.' }, { status: 500 })
  }
}
