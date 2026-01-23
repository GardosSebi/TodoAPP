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
      
      await prisma.user.create({
        data: {
          email,
          password_hash,
          role: 'ADMIN',
        },
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

