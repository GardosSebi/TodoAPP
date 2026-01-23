import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get all users without workspaces
  const users = await prisma.user.findMany({
    where: {
      workspaceId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  for (const user of users) {
    try {
      // Create workspace for user
      const workspace = await prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          userId: user.id,
        },
      })

      // Update user with workspace
      await prisma.user.update({
        where: { id: user.id },
        data: { workspaceId: workspace.id },
      })

      // Update all user's projects to belong to workspace
      await prisma.project.updateMany({
        where: { userId: user.id },
        data: { workspaceId: workspace.id },
      })

      // Update all user's tasks to belong to workspace
      await prisma.task.updateMany({
        where: { userId: user.id },
        data: { workspaceId: workspace.id },
      })
    } catch (error) {
      // Error creating workspace
    }
  }
}

main()
  .catch((e) => {
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

