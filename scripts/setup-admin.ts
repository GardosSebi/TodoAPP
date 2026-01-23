import { PrismaClient } from '@prisma/client'
import { hash } from 'phc-argon2'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function setupAdmin() {
  try {
    const email = 'sebi.gardos@verticaldigital.ca'
    // Generate name from email (convert "sebi.gardos" to "Sebi Gardos")
    const nameFromEmail = email.split('@')[0]
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    const defaultName = nameFromEmail || email.split('@')[0]
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    })

    if (existingAdmin) {
      // Ensure role is ADMIN
      if (existingAdmin.role !== 'ADMIN') {
        await prisma.user.update({
          where: { email },
          data: { role: 'ADMIN' },
        })
      }
      
      const update = await question('\nDo you want to update the password? (y/n): ')
      
      if (update.toLowerCase() === 'y') {
        const password = await question('Enter new password (min 8 characters): ')
        if (password.length < 8) {
          rl.close()
          await prisma.$disconnect()
          return
        }
        
        const password_hash = await hash(password)
        await prisma.user.update({
          where: { email },
          data: {
            password_hash,
            role: 'ADMIN',
          },
        })
      }
    } else {
      const password = await question('Enter password for admin account (min 8 characters): ')
      
      if (password.length < 8) {
        rl.close()
        await prisma.$disconnect()
        return
      }

      const password_hash = await hash(password)
      
      // Create workspace and user in a transaction
      await prisma.$transaction(async (tx) => {
        // Create workspace first
        const workspace = await tx.workspace.create({
          data: {
            name: `${defaultName}'s Workspace`,
          },
        })

        // Create user with workspace
        const newUser = await tx.user.create({
          data: {
            email,
            name: defaultName,
            password_hash,
            role: 'ADMIN',
            workspaceId: workspace.id,
          },
        })

        // Update workspace with userId
        await tx.workspace.update({
          where: { id: workspace.id },
          data: { userId: newUser.id },
        })
      })
    }

    rl.close()
    await prisma.$disconnect()
  } catch (error) {
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }
}

setupAdmin()

