# Todo App

A modern, responsive web-based to-do application built with Next.js 15, TypeScript, PostgreSQL, and Prisma.

## Features

- ✅ User authentication with email/password (NextAuth.js + Argon2)
- ✅ Task CRUD operations with optimistic UI updates
- ✅ Project organization (custom lists)
- ✅ Task metadata: due dates, priority levels, markdown notes
- ✅ Filtering views: Inbox, Today, Upcoming, Completed
- ✅ Mobile-first responsive design
- ✅ Smooth animations with Framer Motion
- ✅ Secure data isolation (users can only see their own tasks)

## Tech Stack

- **Framework**: Next.js 15.0.7 (App Router)
- **Language**: TypeScript 5.3.3
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5.8.1
- **Auth**: NextAuth.js 4.24.5
- **Styling**: Tailwind CSS 3.4.4 + Styled Components 6.1.13
- **UI**: Framer Motion 12.23.24, Headless UI 2.2.9
- **Icons**: Lucide React, Heroicons 2.2.0

## Getting Started

### Prerequisites

- Node.js v14 or higher
- Docker (for PostgreSQL)
- npm or yarn

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/todoapp?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
   ```

   Generate a secure `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

4. **Start PostgreSQL with Docker**:
   ```bash
   docker-compose up -d
   ```

5. **Set up the database**:
   ```bash
   # Generate Prisma Client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Or run migrations
   npm run db:migrate
   ```

6. **Run the development server**:
   ```bash
   npm run dev
   ```

7. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Register a new account** at `/register`
2. **Sign in** at `/login`
3. **Create tasks** using the quick add input
4. **Organize tasks** into projects (custom lists)
5. **Filter tasks** by views:
   - **Inbox**: All active tasks
   - **Today**: Tasks due today
   - **Upcoming**: Tasks due in the future
   - **Completed**: Completed tasks
6. **Edit tasks** by clicking on them to open the details modal
7. **Set priorities** and due dates for better organization

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── tasks/        # Task CRUD operations
│   │   └── projects/     # Project CRUD operations
│   ├── app/              # Protected app routes
│   │   ├── today/        # Today view
│   │   ├── upcoming/     # Upcoming view
│   │   ├── completed/    # Completed view
│   │   └── project/      # Project-specific views
│   ├── login/            # Login page
│   └── register/         # Registration page
├── components/           # React components
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── TaskList.tsx      # Task list with optimistic updates
│   ├── TaskItem.tsx      # Individual task item
│   ├── TaskDetailsModal.tsx  # Task editing modal
│   └── QuickAddTask.tsx  # Quick task creation input
├── lib/                  # Utility functions
│   ├── prisma.ts         # Prisma client instance
│   ├── auth.ts           # NextAuth configuration
│   └── utils.ts          # Helper functions
├── prisma/
│   └── schema.prisma     # Database schema
└── types/                # TypeScript type definitions
```

## Database Schema

### User
- `id`: UUID (Primary Key)
- `email`: String (Unique, Indexed)
- `password_hash`: String (Argon2)
- `created_at`, `updated_at`: Timestamps

### Project
- `id`: UUID (Primary Key)
- `userId`: Foreign Key → User.id
- `name`: String (1-60 characters)
- `color`: String (Hex color, Optional)
- `created_at`, `updated_at`: Timestamps

### Task
- `id`: UUID (Primary Key)
- `userId`: Foreign Key → User.id
- `projectId`: Foreign Key → Project.id (Nullable)
- `title`: String (1-120 characters)
- `notes`: Text (Optional)
- `due_at`: Timestamp (Nullable, Indexed)
- `priority`: Integer (0=none, 1=low, 2=med, 3=high)
- `status`: Enum (ACTIVE, COMPLETED)
- `completed_at`: Timestamp (Nullable)
- `created_at`, `updated_at`: Timestamps

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Tasks
- `GET /api/tasks` - Get tasks (supports `?status=`, `?projectId=`, `?view=`)
- `POST /api/tasks` - Create task
- `GET /api/tasks/[id]` - Get task by ID
- `PATCH /api/tasks/[id]` - Update task
- `DELETE /api/tasks/[id]` - Delete task

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

## Security

- All API routes are protected and scoped by `userId`
- Passwords are hashed using Argon2
- JWT-based session management
- Input validation on all endpoints
- SQL injection protection via Prisma

## Development

### Database Commands
```bash
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
```

### Build for Production
```bash
npm run build
npm start
```

## License

MIT

