import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verify } from 'phc-argon2'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * If there is no User yet but a valid PendingRegistration matches password,
 * return EMAIL_NOT_VERIFIED so the client can show a clear message before calling signIn.
 */
export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password } = bodySchema.parse(await request.json())
    const email = rawEmail.trim().toLowerCase()

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (user) {
      return NextResponse.json({ code: 'OK' })
    }

    const pending = await prisma.pendingRegistration.findUnique({
      where: { email },
    })
    if (!pending || pending.expires_at.getTime() < Date.now()) {
      return NextResponse.json({ code: 'OK' })
    }

    const pwdOk = await verify(pending.password_hash, password)
    if (!pwdOk) {
      return NextResponse.json({ code: 'OK' })
    }

    return NextResponse.json({ code: 'EMAIL_NOT_VERIFIED' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ code: 'OK' })
    }
    return NextResponse.json({ code: 'OK' })
  }
}
