# Seed Data Guide (Todo + CRM)

This project includes a seed script that populates the app with realistic demo data for both task management and CRM flows.

## Run Seed

```bash
npm run db:seed
```

The command runs `scripts/seed.ts` and inserts data in PostgreSQL using Prisma.

## Demo Users and Password

By default, the seed creates or updates these users:

- `demo@todo-crm.local` (ADMIN)
- `sales.alex@todo-crm.local` (USER)
- `ops.bianca@todo-crm.local` (USER)

Default password for all seeded users:

- `Demo12345!`

## Override Default Credentials

You can override the main demo account credentials with environment variables:

```env
SEED_DEMO_EMAIL="my-demo@company.local"
SEED_DEMO_PASSWORD="MyStrongPassword123!"
```

Notes:

- `SEED_DEMO_EMAIL` affects only the main demo account.
- Teammate accounts keep fixed emails.
- Teammate accounts use the same password hash as `SEED_DEMO_PASSWORD`.

## What Data Is Seeded

The script creates realistic test data in the demo workspace:

- workspace + members
- projects
- tags
- tasks, subtasks, comments
- companies, contacts, deals
- CRM notes and interactions
- activity feed, notifications
- task templates and one filter preset

## How Seed Works (Important)

Seed is idempotent for the demo workspace:

- the script ensures users exist (create or update)
- then it clears previously seeded data in the demo workspace
- then inserts fresh demo records

This means you can run `npm run db:seed` multiple times to reset demo data to a known state.

## Recommended Local Flow

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Then sign in with one of the users above at `/login`.
