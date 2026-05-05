import { prisma } from '@/lib/prisma'

/** Row shape used by password reset API (avoids stale PrismaClient typings before `prisma generate`). */
export type PasswordResetTokenRow = {
  id: string
  userId: string
  token_hash: string
  expires_at: Date
}

type PasswordResetTokenDelegate = {
  deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>
  create(args: {
    data: { token_hash: string; userId: string; expires_at: Date }
  }): Promise<unknown>
  findUnique(args: {
    where: { token_hash: string }
  }): Promise<PasswordResetTokenRow | null>
}

/** Transaction client or root `prisma` — cast for stable typings. */
function passwordResetTokenOn(
  client: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): PasswordResetTokenDelegate {
  return (client as unknown as { passwordResetToken: PasswordResetTokenDelegate }).passwordResetToken
}

function passwordResetToken(): PasswordResetTokenDelegate {
  return passwordResetTokenOn(prisma)
}

export async function replaceUserPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const tokens = passwordResetTokenOn(tx)
    await tokens.deleteMany({ where: { userId } })
    await tokens.create({
      data: {
        token_hash: tokenHash,
        userId,
        expires_at: expiresAt,
      },
    })
  })
}

export async function findPasswordResetTokenByHash(
  tokenHash: string
): Promise<PasswordResetTokenRow | null> {
  return passwordResetToken().findUnique({ where: { token_hash: tokenHash } })
}

export async function applyPasswordReset(
  userId: string,
  password_hash: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { password_hash },
    })
    await passwordResetTokenOn(tx).deleteMany({ where: { userId } })
  })
}
