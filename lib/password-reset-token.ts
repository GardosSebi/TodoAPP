import { createHash, randomBytes } from 'crypto'

const TOKEN_BYTES = 32

export function createPasswordResetSecret(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashPasswordResetToken(rawToken)
  return { rawToken, tokenHash }
}

export function hashPasswordResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}
