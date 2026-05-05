import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'
import { hash } from 'phc-argon2'
import * as readline from 'readline'

loadEnvConfig(process.cwd())

const prisma = new PrismaClient({ log: [] })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve))
}

function resolveAdminEmail(): Promise<string> {
  const fromArg = process.argv[2]?.trim()
  const fromEnv = process.env.ADMIN_SETUP_EMAIL?.trim()
  if (fromArg) return Promise.resolve(fromArg)
  if (fromEnv) return Promise.resolve(fromEnv)
  return question('Admin email: ')
}

async function setupAdmin() {
  try {
    const emailRaw = await resolveAdminEmail()
    const email = emailRaw.trim().toLowerCase()
    if (!email.includes('@')) {
      process.stderr.write('Invalid email.\n')
      rl.close()
      await prisma.$disconnect()
      process.exit(1)
    }

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
        process.stdout.write(`\nRole set to ADMIN for ${email}\n`)
      } else {
        process.stdout.write(`\nUser ${email} is already ADMIN.\n`)
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
        process.stdout.write('Password updated.\n')
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
      process.stdout.write(`\nAdmin user created: ${email}\n`)
    }

    rl.close()
    await prisma.$disconnect()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    rl.close()
    await prisma.$disconnect()
    process.exit(1)
  }
}

setupAdmin()

