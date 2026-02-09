import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Fetch current user data
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <SettingsClient
      initialUser={{
        ...user,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      }}
    />
  )
}

