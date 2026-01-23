# Workspace Migration Guide

This document explains the workspace feature implementation and how to migrate existing data.

## Overview

All projects and tasks are now contained within a user's workspace. Each user has exactly one workspace, named after the user (e.g., "John's Workspace").

## Database Changes

1. **New Workspace Model**: Added to contain all user's projects and tasks
2. **User Model**: Added `workspaceId` field (required, unique)
3. **Project Model**: Added `workspaceId` field (required)
4. **Task Model**: Added `workspaceId` field (required)

## Migration Steps

### 1. Update Database Schema

Run the Prisma migration to apply schema changes:

```bash
npx prisma migrate dev --name add_workspace_system
```

Or if you prefer to push directly (for development):

```bash
npx prisma db push
```

### 2. Migrate Existing Users

Run the migration script to create workspaces for existing users and update their projects/tasks:

```bash
npx tsx scripts/migrate-workspaces.ts
```

This script will:
- Find all users without workspaces
- Create a workspace for each user (named "{User's Name}'s Workspace")
- Update all user's projects to belong to their workspace
- Update all user's tasks to belong to their workspace

### 3. Verify Migration

After running the migration, verify that:
- All users have a workspace
- All projects have a workspaceId
- All tasks have a workspaceId

You can check this in Prisma Studio:

```bash
npx prisma studio
```

## API Changes

### New Endpoint
- `GET /api/workspace` - Get current user's workspace information

### Updated Endpoints
- `POST /api/auth/register` - Now creates a workspace automatically
- `POST /api/admin/users` - Now creates a workspace for new users
- `POST /api/projects` - Now requires and sets workspaceId
- `POST /api/tasks` - Now requires and sets workspaceId

## UI Changes

- Sidebar now displays the workspace name instead of "Todo App"
- Workspace name is fetched from the API and displayed dynamically

## Notes

- New users will automatically get a workspace created during registration
- The workspace name format is: "{User's Name}'s Workspace"
- For admin-created users, the workspace name uses the email prefix: "{email_prefix}'s Workspace"
- All existing projects and tasks will be migrated to their user's workspace

