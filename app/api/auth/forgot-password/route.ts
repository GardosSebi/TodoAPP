import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmail, createPasswordResetEmail } from '@/lib/email'
import { createPasswordResetSecret } from '@/lib/password-reset-token'
import { replaceUserPasswordResetToken } from '@/lib/password-reset-store'

const bodySchema = z.object({
  email: z.string().email(),
})

const RESET_EXPIRY_HOURS = 1

const genericMessage = {
  message:
    'Dacă există un cont pentru această adresă de e-mail, veți primi în scurt timp instrucțiuni de resetare a parolei.',
}

export async function POST(request: NextRequest) {
  try {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { email: rawEmail } = bodySchema.parse(json)
    const email = rawEmail.trim()

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, name: true },
    })

    if (user) {
      const { rawToken, tokenHash } = createPasswordResetSecret()
      const expires_at = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000)

      await replaceUserPasswordResetToken(user.id, tokenHash, expires_at)

      const appUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
      const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
      const notification = createPasswordResetEmail(user.name, resetLink, RESET_EXPIRY_HOURS)
      notification.to = user.email
      await sendEmail(notification)
    }

    return NextResponse.json(genericMessage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Unable to process request. Please try again later.' },
      { status: 500 }
    )
  }
}
