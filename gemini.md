# Task Management Application - Complete Specification

Build a modern, full-stack task management application with workspace collaboration features, multi-workspace support, and a comprehensive project organization system.

## Technology Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript 5.3+
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5.8+
- **Authentication**: NextAuth.js 4.24+ with Credentials Provider
- **Password Hashing**: phc-argon2 (Argon2 algorithm)
- **Styling**: Tailwind CSS 3.4+ with dark mode support
- **UI Libraries**: Framer Motion for animations, Lucide React for icons
- **Validation**: Zod for API input validation
- **File Storage**: Local filesystem (uploads stored in `public/uploads/tasks/[taskId]/`)

## Core Requirements

### Database Schema (Prisma)

```prisma
enum TaskStatus {
  ACTIVE
  COMPLETED
  NOT_STARTED
  IN_PROGRESS
  FINISHED
}

enum UserRole {
  ADMIN
  USER
}

model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  name                  String
  password_hash         String
  role                  UserRole  @default(USER)
  workspaceId           String    @unique
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projects              Project[]
  tasks                 Task[]
  teamMembers           TeamMember[] @relation("TeamMember")
  admin                 TeamMember[] @relation("Admin")
  sharedProjects        ProjectMember[]
  workspaceMemberships  WorkspaceMember[] @relation("WorkspaceMember")
  workspaceInvitations  WorkspaceInvitation[] @relation("WorkspaceInvitation")
  sentWorkspaceInvitations WorkspaceInvitation[] @relation("WorkspaceInviter")

  @@index([email])
  @@index([role])
  @@index([workspaceId])
}

model Workspace {
  id            String   @id @default(uuid())
  name          String
  userId        String?  @unique  // Owner ID
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  
  user          User?  // Owner
  projects      Project[]
  tasks         Task[]
  members       WorkspaceMember[]
  invitations   WorkspaceInvitation[]

  @@index([userId])
}

model WorkspaceMember {
  id          String   @id @default(uuid())
  workspaceId String
  userId      String
  role        String   @default("MEMBER")  // OWNER, MEMBER
  invited_by  String?
  created_at  DateTime @default(now())
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation("WorkspaceMember", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([workspaceId])
  @@index([userId])
}

model WorkspaceInvitation {
  id          String   @id @default(uuid())
  workspaceId String
  userId      String   // Invited user
  invited_by  String   // User who sent invitation
  status      String   @default("PENDING")  // PENDING, ACCEPTED, DENIED
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation("WorkspaceInvitation", fields: [userId], references: [id], onDelete: Cascade)
  inviter     User      @relation("WorkspaceInviter", fields: [invited_by], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([workspaceId])
  @@index([userId])
  @@index([status])
}

model Project {
  id          String   @id @default(uuid())
  userId      String   // Project owner
  workspaceId String
  name        String   @db.VarChar(60)
  color       String?  // Hex color code
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       Task[]
  members     ProjectMember[]

  @@index([userId])
  @@index([workspaceId])
}

model Task {
  id           String     @id @default(uuid())
  userId       String     // Task creator/owner
  workspaceId  String     // Workspace task belongs to
  projectId    String?    // Optional project assignment
  title        String     @db.VarChar(120)
  notes        String?    @db.Text
  due_at       DateTime?  // Due date/time
  priority     Int        @default(0)  // 0=none, 1=low, 2=medium, 3=high
  status       TaskStatus @default(ACTIVE)
  completed_at DateTime?
  responsible  String?    @db.VarChar(100)  // Person responsible (assigned by workspace owner)
  created_at   DateTime   @default(now())
  updated_at   DateTime   @updatedAt
  
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace    Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project      Project?   @relation(fields: [projectId], references: [id], onDelete: SetNull)
  files        TaskFile[]

  @@index([userId])
  @@index([workspaceId])
  @@index([projectId])
  @@index([due_at])
  @@index([status])
}

model TaskFile {
  id          String   @id @default(uuid())
  taskId      String
  fileName    String
  filePath    String
  fileSize    Int      // Bytes
  mimeType    String
  uploaded_at DateTime @default(now())
  
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
}

model TeamMember {
  id        String   @id @default(uuid())
  adminId   String   // Admin user
  userId    String   // Team member user
  created_at DateTime @default(now())
  
  admin     User     @relation("Admin", fields: [adminId], references: [id], onDelete: Cascade)
  user      User     @relation("TeamMember", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([adminId, userId])
  @@index([adminId])
  @@index([userId])
}

model ProjectMember {
  id        String   @id @default(uuid())
  projectId String
  userId    String
  created_at DateTime @default(now())
  
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}
```

## Application Architecture

### Directory Structure

```
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts    # NextAuth endpoints
│   │   │   └── register/route.ts         # User registration
│   │   ├── tasks/
│   │   │   ├── route.ts                  # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts              # GET, PATCH, DELETE
│   │   │       └── files/
│   │   │           ├── route.ts          # GET (list), POST (upload)
│   │   │           └── [fileId]/route.ts # DELETE
│   │   ├── projects/
│   │   │   ├── route.ts                  # GET, POST
│   │   │   └── [id]/
│   │   │       ├── route.ts              # PATCH, DELETE
│   │   │       └── members/
│   │   │           ├── route.ts          # GET, POST
│   │   │           └── [memberId]/route.ts # DELETE
│   │   ├── workspace/
│   │   │   ├── route.ts                  # GET (current workspace)
│   │   │   ├── members/
│   │   │   │   ├── route.ts              # GET, POST (invite)
│   │   │   │   └── [memberId]/route.ts   # DELETE
│   │   │   └── invitations/
│   │   │       ├── route.ts              # GET (pending invitations)
│   │   │       └── [invitationId]/route.ts # POST (accept), DELETE (deny)
│   │   ├── admin/
│   │   │   └── users/
│   │   │       ├── route.ts              # GET, POST
│   │   │       └── [id]/route.ts         # PATCH, DELETE
│   │   └── team/
│   │       ├── route.ts                  # GET, POST
│   │       └── [id]/route.ts             # DELETE
│   ├── app/
│   │   ├── layout.tsx                    # App layout with Sidebar
│   │   ├── page.tsx                      # Inbox page (Primite) - shows invitations + tasks
│   │   ├── InboxClient.tsx               # Client component for inbox
│   │   ├── today/
│   │   │   ├── page.tsx                  # Calendar view (server component)
│   │   │   └── TodayClient.tsx           # Calendar client component
│   │   ├── upcoming/
│   │   │   ├── page.tsx                  # Upcoming tasks (7 days)
│   │   │   └── UpcomingClient.tsx        # Upcoming client (grouped by project)
│   │   ├── completed/
│   │   │   ├── page.tsx                  # Completed tasks
│   │   │   └── CompletedClient.tsx       # Completed client (grouped by project)
│   │   └── project/[id]/
│   │       ├── page.tsx                  # Project detail page
│   │       └── ProjectClient.tsx         # Kanban board client
│   ├── login/page.tsx                    # Login page
│   ├── register/page.tsx                 # Registration page
│   └── providers.tsx                     # NextAuth SessionProvider
├── components/
│   ├── Sidebar.tsx                       # Main navigation sidebar
│   ├── WorkspaceMembers.tsx              # Workspace members list (invite/remove)
│   ├── TaskList.tsx                      # Task list component
│   ├── TaskItem.tsx                      # Individual task item
│   ├── TaskDetailsModal.tsx              # Task edit modal (with file uploads)
│   ├── QuickAddTask.tsx                  # Quick task creation form
│   ├── KanbanBoard.tsx                   # Kanban board (NOT_STARTED, IN_PROGRESS)
│   ├── Calendar.tsx                      # Calendar component
│   ├── TeamManagement.tsx                # Admin team management
│   └── TaskList.tsx                      # List view for tasks
├── lib/
│   ├── prisma.ts                         # Prisma client singleton
│   ├── auth.ts                           # NextAuth configuration
│   └── utils.ts                          # Utility functions (date formatting, etc.)
├── types/
│   ├── index.ts                          # TypeScript interfaces
│   └── next-auth.d.ts                    # NextAuth type extensions
├── prisma/
│   └── schema.prisma                     # Database schema
└── middleware.ts                         # Route protection middleware
```

## Key Features & Requirements

### 1. Authentication System

**Registration** (`POST /api/auth/register`):
- Email and password validation
- Check email uniqueness
- Hash password with Argon2
- Create user with default workspace
- Auto-create workspace named "{user email prefix}'s Workspace"
- Set user as workspace owner
- Return user object

**Login** (NextAuth Credentials Provider):
- Validate email/password
- Verify Argon2 password hash
- Create JWT session with: `{ id, email, role }`
- Redirect to `/app` on success

**Session Management**:
- JWT-based sessions (no database sessions)
- All `/app/*` routes protected by middleware
- API routes check session with `getServerSession(authOptions)`

### 2. Workspace System

**Workspace Creation**:
- Automatically created on user registration
- Each user has exactly one workspace they own
- Workspace name: "{name}'s Workspace" (extracted from email or provided)

**Workspace Invitations**:
- Only workspace owner can send invitations
- Invite by email (user must exist in system)
- Create `WorkspaceInvitation` with status PENDING
- Invited user sees invitation in Inbox page ("Primite")
- Invited user can accept or deny invitation
- On accept: create `WorkspaceMember` entry, update invitation status to ACCEPTED
- On deny: update invitation status to DENIED

**Workspace Members Display**:
- In sidebar, show "MEMBRI WORKSPACE" section
- Display all workspace members EXCEPT the owner
- Owner is not shown in members list
- Members can be removed by owner (X button on hover)

**Multi-Workspace Access**:
- Users can be members of multiple workspaces
- Tasks, projects shown from ALL accessible workspaces (owned + member of)
- All views (Inbox, Today, Upcoming, Completed) show tasks from all accessible workspaces

### 3. Project Management

**Project Creation**:
- Created in user's primary workspace
- Projects belong to workspace, owned by user
- Projects can be shared with workspace members (via ProjectMember)
- Project has: name (1-60 chars), optional color (hex)

**Project Views**:
- Displayed in sidebar under "PROIECTE"
- Show project name, color-coded folder icon, task count
- Click to open project page with Kanban board
- Delete button (X) appears on hover for owned projects
- Confirm dialog before deletion: "Ești sigur că vrei să ștergi acest proiect? Toate sarcinile vor fi eliminate."
- On delete: redirect to `/app` if currently viewing deleted project

**Kanban Board**:
- Display only 2 columns: "Neînceput" (NOT_STARTED) and "În Progres" (IN_PROGRESS)
- Do NOT show "Finalizat" (FINISHED) column
- Tasks with status ACTIVE (without completed_at) map to NOT_STARTED
- Tasks with status NOT_STARTED map to NOT_STARTED column
- Tasks with status IN_PROGRESS map to IN_PROGRESS column
- Tasks with status COMPLETED or FINISHED should NOT appear in project view
- Drag-and-drop between columns updates task status
- When dropping in NOT_STARTED: set status to NOT_STARTED
- When dropping in IN_PROGRESS: set status to IN_PROGRESS
- New tasks in projects default to NOT_STARTED status

### 4. Task Management

**Task Creation**:
- Title required (1-120 chars)
- Optional: notes, due date, priority (0-3), project assignment, responsible person
- For project tasks: default status is NOT_STARTED
- For standalone tasks: default status is ACTIVE
- Task belongs to workspace (user's primary workspace or project's workspace)
- Only workspace owner can assign "responsible" person

**Task Status**:
- Status values: ACTIVE, COMPLETED, NOT_STARTED, IN_PROGRESS, FINISHED
- ACTIVE: Default for standalone tasks, shown in inbox/views
- NOT_STARTED: Default for project tasks, shown in Kanban "Neînceput"
- IN_PROGRESS: Tasks being worked on, shown in Kanban "În Progres"
- COMPLETED: Completed tasks, shown in "Finalizate" view
- FINISHED: Alternative completed status, treated same as COMPLETED

**Task Metadata**:
- Priority: 0 (none), 1 (low), 2 (medium), 3 (high)
- Due date: Optional DateTime
- Notes: Optional text field
- Responsible: Optional string (only workspace owner can set)
- Files: Multiple file attachments per task

**Task File Attachments**:
- Files stored in `public/uploads/tasks/[taskId]/[timestamp]_[filename]`
- Support any file type
- Display file name, size, upload date
- Preview images inline
- Delete files individually
- Upload via TaskDetailsModal

### 5. Views & Pages

#### Inbox Page (`/app` - "Primite")
- Display workspace invitations at top:
  - Show workspace name and inviter name/email
  - Accept (green) and Deny (red) buttons
  - Invitations disappear after action
  - After accepting, refresh page to show new workspace data
- Display all active tasks from all accessible workspaces
- No task creation form on this page

#### Calendar Page (`/app/today` - "Calendar")
- Full calendar view showing all tasks with due dates
- Highlight today's date
- Click date to see tasks due that day
- Click task to open TaskDetailsModal
- No "Quick Add" or "Tasks for Today" sections - just calendar

#### Upcoming Page (`/app/upcoming` - "Viitoare")
- Show ONLY tasks with due dates within next 7 days
- Tasks NOT completed/finished (status NOT IN ['COMPLETED', 'FINISHED'])
- Group tasks by project (collapsible sections)
- Same format as Completed page:
  - Projects as expandable cards
  - "Fără proiect" section for tasks without project
  - Header: "Sarcini în următoarele 7 zile (X)"
- No task creation form
- Include tasks from ALL accessible workspaces

#### Completed Page (`/app/completed` - "Finalizate")
- Show ONLY tasks with status COMPLETED
- Group tasks by project (collapsible sections)
- Format:
  - Each project as expandable card with chevron
  - Project name, folder icon with color, task count
  - Expanded shows TaskItem components for each completed task
  - "Fără proiect" section for completed tasks without project
  - Header: "Proiecte: X • Sarcini finalizate: Y"
- Include tasks from ALL accessible workspaces

#### Project Page (`/app/project/[id]`)
- Kanban board with 2 columns: NOT_STARTED and IN_PROGRESS
- Quick add task form at top: "Adaugă o sarcină la acest proiect..."
- Tasks filtered by projectId
- Exclude completed/finished tasks (only show active tasks)
- Task count in header
- Drag-and-drop to change status
- Click task to open TaskDetailsModal

### 6. UI Components

#### Sidebar Component
- Fixed left sidebar, dark theme by default
- Top: Workspace name (user's primary workspace name)
- Navigation links:
  - "Primite" (Inbox) with envelope icon
  - "Calendar" with calendar icon
  - "Viitoare" (Upcoming) with clock icon
  - "Finalizate" (Completed) with checkmark icon
- "PROIECTE" section:
  - List all projects from accessible workspaces
  - Show project name, color, task count
  - Delete button (X) on hover for owned projects
  - Create project button (+)
- "MEMBRI WORKSPACE" section:
  - List workspace members (NOT the owner)
  - Invite button (+) for owner
  - Remove button (X) on hover for members
- Bottom: User email, theme toggle, logout button
- Dark theme as default

#### TaskItem Component
- Display: checkbox, title, priority flag, due date, project tag
- Show overdue tasks with red border/text
- Click to open TaskDetailsModal
- Checkbox toggles completion status

#### TaskDetailsModal Component
- Full-screen modal for task editing
- Fields: title, notes, due date, priority, responsible (if workspace owner), project assignment
- File upload section with drag-and-drop
- Display attached files with delete option
- Image preview for image files
- Save and Delete buttons

#### KanbanBoard Component
- 2 columns: NOT_STARTED and IN_PROGRESS
- Drag-and-drop functionality
- Task cards show: title, priority, due date, project tag, responsible person
- Highlight overdue tasks
- Empty state: "Fără sarcini" when no tasks

#### Calendar Component
- Month view with navigation
- Highlight tasks with due dates
- Show task count per day
- Click date/task to view details
- Support for viewing all months

### 7. API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
  - Body: `{ email, password }`
  - Creates user, workspace, assigns ownership
  - Returns: `{ user }`

- NextAuth endpoints: `/api/auth/[...nextauth]`
  - Handles: sign in, sign out, session, callback

#### Workspace
- `GET /api/workspace` - Get current workspace info
  - Returns workspace user owns or is member of
  - Returns: `{ workspace: { id, name, isOwner: boolean } }`

- `GET /api/workspace/members` - Get workspace members
  - Returns ONLY members, NOT the owner
  - Returns: `{ members: Array<{id, userId, role, user: {id, email, name}, created_at}> }`

- `POST /api/workspace/members` - Invite member
  - Only workspace owner can invite
  - Body: `{ email }`
  - Creates WorkspaceInvitation with status PENDING
  - Returns: `{ invitation: {...} }`

- `DELETE /api/workspace/members/[memberId]` - Remove member
  - Only workspace owner can remove
  - Returns: `{ success: true }`

#### Workspace Invitations
- `GET /api/workspace/invitations` - Get pending invitations
  - Returns user's pending invitations
  - Returns: `{ invitations: Array<{id, workspace: {id, name}, inviter: {id, email, name}, status, created_at}> }`

- `POST /api/workspace/invitations/[invitationId]` - Accept invitation
  - Creates WorkspaceMember entry
  - Updates invitation status to ACCEPTED
  - Returns: `{ success: true }`

- `DELETE /api/workspace/invitations/[invitationId]` - Deny invitation
  - Updates invitation status to DENIED
  - Returns: `{ success: true }`

#### Tasks
- `GET /api/tasks` - Get tasks
  - Query params: `?status=`, `?projectId=`, `?view=today|upcoming|completed`
  - Returns tasks from ALL accessible workspaces
  - Returns: `{ tasks: Task[] }`
  - Includes project, files, formatted dates

- `POST /api/tasks` - Create task
  - Body: `{ title, notes?, due_at?, priority?, projectId?, responsible? }`
  - Validates with Zod
  - Only workspace owner can set responsible
  - Default status: NOT_STARTED for project tasks, ACTIVE for standalone
  - Returns: `{ task }`

- `GET /api/tasks/[id]` - Get task by ID
  - Returns: `{ task }` or 404

- `PATCH /api/tasks/[id]` - Update task
  - Body: Partial task fields
  - Only workspace owner can update responsible field
  - Returns: `{ task }`

- `DELETE /api/tasks/[id]` - Delete task
  - Returns: `{ success: true }`

#### Task Files
- `GET /api/tasks/[id]/files` - Get task files
  - Returns: `{ files: TaskFile[] }`

- `POST /api/tasks/[id]/files` - Upload file
  - Multipart form data with `file` field
  - Stores in `public/uploads/tasks/[taskId]/[timestamp]_[filename]`
  - Returns: `{ file: TaskFile }`

- `DELETE /api/tasks/[id]/files/[fileId]` - Delete file
  - Deletes file from filesystem and database
  - Returns: `{ success: true }`

#### Projects
- `GET /api/projects` - Get projects
  - Returns all projects from accessible workspaces
  - Returns: `{ projects: Project[] }`
  - Includes task count, user info, workspace info

- `POST /api/projects` - Create project
  - Body: `{ name, color? }`
  - Created in user's primary workspace
  - Returns: `{ project }`

- `PATCH /api/projects/[id]` - Update project
  - Only project owner can update
  - Body: `{ name?, color? }`
  - Returns: `{ project }`

- `DELETE /api/projects/[id]` - Delete project
  - Only project owner can delete
  - Sets all task projectId to null (cascade: SetNull)
  - Returns: `{ success: true }`

#### Project Members
- `GET /api/projects/[id]/members` - Get project members
- `POST /api/projects/[id]/members` - Add member to project
- `DELETE /api/projects/[id]/members/[memberId]` - Remove member

### 8. Security & Access Control

**Data Isolation**:
- All queries filter by workspace access (owner OR member)
- Users see tasks from ALL accessible workspaces
- Projects filtered by workspace membership
- Tasks filtered by workspaceId (not just userId)

**Access Rules**:
- Workspace owner can: invite/remove members, assign responsible persons
- Workspace members can: view all tasks/projects in workspace, create/edit tasks
- Project owner can: edit/delete project, manage project members
- Project members can: view/edit tasks in project
- Only project owner can delete project

**Authentication**:
- All `/app/*` routes protected by middleware
- All API routes check `getServerSession(authOptions)`
- Return 401 if unauthorized
- Return 403 if insufficient permissions

**Input Validation**:
- All API endpoints use Zod schemas
- Validate email format, string lengths, enums, etc.
- Return 400 with error details on validation failure

### 9. UI/UX Requirements

**Theme**:
- Dark theme as DEFAULT
- Theme toggle in sidebar (moon/sun icon)
- Persist theme preference (localStorage or state)
- Apply `dark` class to `document.documentElement`

**Language**:
- All UI text in Romanian
- Labels: "Primite", "Calendar", "Viitoare", "Finalizate", "Proiecte", "Membri Workspace"
- Buttons: "Adaugă", "Acceptă", "Respinge", "Șterge", "Salvează"
- Messages: "Ești sigur că...", "Invitație trimisă cu succes", etc.

**Animations**:
- Use Framer Motion for smooth transitions
- Task list animations on add/remove
- Modal animations (fade, scale)
- Kanban drag-and-drop with visual feedback

**Responsive Design**:
- Mobile-first approach
- Sidebar collapsible on mobile
- Kanban board stacks on mobile
- Calendar responsive grid

**Error Handling**:
- Display user-friendly error messages in Romanian
- Handle API errors gracefully
- Show loading states during operations
- Optimistic UI updates with rollback on error

### 10. Special Requirements

**No Console Logging**:
- Remove all `console.log()` and `console.error()` statements
- Replace with comments where needed for context

**File Uploads**:
- Store in `public/uploads/tasks/[taskId]/`
- Filename format: `[timestamp]_[originalFilename]`
- Validate file size (suggest max 10MB per file)
- Support all MIME types
- Display file size in human-readable format

**Date Handling**:
- All dates stored as UTC in database
- Format dates for display in user's locale (Romanian)
- Handle timezone conversions properly
- Show relative dates where appropriate ("Astăzi", "Mâine", etc.)

**Task Filtering Logic**:
- Inbox: All ACTIVE tasks from all accessible workspaces
- Calendar: All tasks with due_at, from all accessible workspaces
- Upcoming: Tasks with due_at within 7 days, NOT completed/finished, from all accessible workspaces
- Completed: All COMPLETED tasks, from all accessible workspaces
- Project view: All tasks in project, excluding COMPLETED/FINISHED

**Kanban Status Mapping**:
- NOT_STARTED column: Tasks with status NOT_STARTED OR (status ACTIVE AND completed_at is null)
- IN_PROGRESS column: Tasks with status IN_PROGRESS
- Do NOT show FINISHED/COMPLETED tasks in Kanban board

### 11. Database Queries Pattern

**Getting Accessible Workspaces**:
```typescript
const userWorkspaces = await prisma.workspace.findMany({
  where: {
    OR: [
      { userId: session.user.id },  // Owned
      { members: { some: { userId: session.user.id } } }  // Member of
    ]
  },
  select: { id: true }
})
const workspaceIds = userWorkspaces.map(w => w.id)
```

**Getting Tasks from All Workspaces**:
```typescript
const tasks = await prisma.task.findMany({
  where: {
    workspaceId: { in: workspaceIds },
    // ... other filters
  }
})
```

**Getting Projects from All Workspaces**:
```typescript
const projects = await prisma.project.findMany({
  where: {
    workspaceId: { in: workspaceIds }
  }
})
```

### 12. Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/todoapp?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

### 13. Initial Setup

1. Create database and run migrations
2. Run migration script to create workspaces for existing users (if any)
3. Setup admin user with `scripts/setup-admin.ts`
4. Generate Prisma Client: `npx prisma generate`
5. Start development server: `npm run dev`

### 14. Important Notes

- Default theme is DARK
- Workspace owner is NEVER shown in members list
- Completed/FINISHED tasks do NOT appear in Kanban board
- Kanban shows only 2 columns (NOT_STARTED, IN_PROGRESS)
- All views show tasks from ALL accessible workspaces (multi-workspace)
- Invitations appear in Inbox page, not as separate notifications
- Project grouping in Upcoming/Completed uses expandable cards
- No console.log or console.error statements anywhere
- Romanian language throughout the UI

Build this application following modern Next.js 15 patterns, with full TypeScript support, proper error handling, and a polished, accessible user interface.
