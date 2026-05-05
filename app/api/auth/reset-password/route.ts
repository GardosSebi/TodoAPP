import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'phc-argon2'
import { z } from 'zod'
import { hashPasswordResetToken } from '@/lib/password-reset-token'
import {
  applyPasswordReset,
  findPasswordResetTokenByHash,
} from '@/lib/password-reset-store'

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { token, password } = bodySchema.parse(json)
    const tokenHash = hashPasswordResetToken(token)

    const record = await findPasswordResetTokenByHash(tokenHash)

    if (!record || record.expires_at.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const password_hash = await hash(password)
    await applyPasswordReset(record.userId, password_hash)

    return NextResponse.json({ message: 'Password has been reset. You can sign in now.' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
