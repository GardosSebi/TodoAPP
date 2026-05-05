import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hash } from 'phc-argon2'
import { z } from 'zod'
import { sendEmail, createRegistrationConfirmationEmail } from '@/lib/email'
import { createPasswordResetSecret } from '@/lib/password-reset-token'

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8),
})

const VERIFY_HOURS = 24

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email: rawEmail, name, password } = registerSchema.parse(body)
    const email = rawEmail.trim().toLowerCase()

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    const password_hash = await hash(password)
    const { rawToken, tokenHash } = createPasswordResetSecret()
    const expires_at = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000)

    await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        name: name.trim(),
        password_hash,
        token_hash: tokenHash,
        expires_at,
      },
      update: {
        name: name.trim(),
        password_hash,
        token_hash: tokenHash,
        expires_at,
      },
    })

    const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
    const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`
    const confirmation = createRegistrationConfirmationEmail(name.trim(), verifyUrl)
    confirmation.to = email
    await sendEmail(confirmation)

    return NextResponse.json(
      {
        message:
          'Ți-am trimis un email de confirmare. Contul se creează după ce apeși linkul din mesaj.',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
