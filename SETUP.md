# Quick Setup Guide

## 1. Install Dependencies
```bash
npm install
```

## 2. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/todoapp?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"
```

To generate a secure `NEXTAUTH_SECRET`:
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## 3. Start PostgreSQL Database
```bash
docker-compose up -d
```

## 4. Initialize Database
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

## 5. Start Development Server
```bash
npm run dev
```

## 6. Access the Application
Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Steps
1. Register a new account at `/register`
2. Sign in at `/login`
3. Start creating tasks!

## Troubleshooting

### Database Connection Issues
- Ensure Docker is running
- Check that PostgreSQL container is up: `docker ps`
- Verify DATABASE_URL in `.env` matches docker-compose.yml settings

### Prisma Issues
- Run `npm run db:generate` after schema changes
- Use `npm run db:studio` to inspect the database

### NextAuth Issues
- Ensure `NEXTAUTH_SECRET` is set in `.env`
- Verify `NEXTAUTH_URL` matches your development URL

