import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return false
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  return user?.role === 'ADMIN'
}

export async function requireAdmin() {
  const admin = await isAdmin()
  
  if (!admin) {
    throw new Error('Admin access required')
  }
}

