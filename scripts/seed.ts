import { loadEnvConfig } from '@next/env'
import {
  CompanyStatus,
  ContactStatus,
  DealStage,
  PrismaClient,
  TaskStatus,
  TaskType,
  UserRole,
} from '@prisma/client'
import { hash } from 'phc-argon2'

loadEnvConfig(process.cwd())

const prisma = new PrismaClient({ log: [] })

const DEMO_USER_EMAIL = process.env.SEED_DEMO_EMAIL?.trim().toLowerCase() ?? 'demo@todo-crm.local'
const DEMO_USER_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!'

type SeedUser = {
  id: string
  workspaceId: string
  name: string
  email: string
}

async function ensureUserWithWorkspace(
  email: string,
  name: string,
  passwordHash: string,
  role: UserRole = UserRole.USER,
): Promise<SeedUser> {
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        password_hash: passwordHash,
        role,
      },
    })

    const workspace = await prisma.workspace.findUnique({ where: { id: existing.workspaceId } })
    if (!workspace) {
      throw new Error(`Workspace missing for user ${normalizedEmail}.`)
    }

    if (!workspace.userId) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { userId: existing.id },
      })
    }

    return { id: existing.id, workspaceId: existing.workspaceId, name, email: normalizedEmail }
  }

  const created = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: `${name} Workspace`,
      },
    })

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name,
        password_hash: passwordHash,
        role,
        workspaceId: workspace.id,
      },
    })

    await tx.workspace.update({
      where: { id: workspace.id },
      data: { userId: user.id },
    })

    return user
  })

  return { id: created.id, workspaceId: created.workspaceId, name, email: normalizedEmail }
}

async function seed() {
  const passwordHash = await hash(DEMO_USER_PASSWORD)

  const owner = await ensureUserWithWorkspace(DEMO_USER_EMAIL, 'Demo Admin', passwordHash, UserRole.ADMIN)
  const teammateA = await ensureUserWithWorkspace('sales.alex@todo-crm.local', 'Alex Popescu', passwordHash, UserRole.USER)
  const teammateB = await ensureUserWithWorkspace('ops.bianca@todo-crm.local', 'Bianca Ionescu', passwordHash, UserRole.USER)

  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: owner.workspaceId },
      data: { name: 'Demo CRM Workspace' },
    })

    await tx.teamMember.deleteMany({ where: { adminId: owner.id } })
    await tx.workspaceInvitation.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.workspaceMember.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.activity.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.interaction.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.cRMNote.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.task.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.deal.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.contact.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.company.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.project.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.tag.deleteMany({ where: { workspaceId: owner.workspaceId } })
    await tx.taskTemplate.deleteMany({ where: { workspaceId: owner.workspaceId } })

    await tx.filterPreset.deleteMany({ where: { userId: owner.id } })
    await tx.notification.deleteMany({ where: { userId: owner.id } })

    await tx.workspaceMember.createMany({
      data: [
        { workspaceId: owner.workspaceId, userId: owner.id, role: 'OWNER' },
        { workspaceId: owner.workspaceId, userId: teammateA.id, role: 'MEMBER', invited_by: owner.id },
        { workspaceId: owner.workspaceId, userId: teammateB.id, role: 'MEMBER', invited_by: owner.id },
      ],
    })

    await tx.teamMember.createMany({
      data: [
        { adminId: owner.id, userId: teammateA.id },
        { adminId: owner.id, userId: teammateB.id },
      ],
    })

    const inboxProject = await tx.project.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        name: 'Inbox',
        color: '#2563eb',
        order: 1,
      },
    })

    const onboardingProject = await tx.project.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        name: 'Client Onboarding',
        color: '#7c3aed',
        order: 2,
      },
    })

    const retentionProject = await tx.project.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        name: 'Retention',
        color: '#059669',
        order: 3,
      },
    })

    const tags = await Promise.all([
      tx.tag.create({ data: { workspaceId: owner.workspaceId, name: 'Urgent', color: '#dc2626' } }),
      tx.tag.create({ data: { workspaceId: owner.workspaceId, name: 'Follow-up', color: '#f59e0b' } }),
      tx.tag.create({ data: { workspaceId: owner.workspaceId, name: 'Meeting', color: '#0ea5e9' } }),
      tx.tag.create({ data: { workspaceId: owner.workspaceId, name: 'Q2', color: '#10b981' } }),
    ])

    const companyA = await tx.company.create({
      data: {
        workspaceId: owner.workspaceId,
        name: 'Nova Logistics',
        website: 'https://novalogistics.example',
        industry: 'Logistics',
        size: '51-200',
        location: 'Bucharest',
        status: CompanyStatus.ACTIVE_CUSTOMER,
        notes: 'Client activ cu plan enterprise.',
        created_by: owner.id,
        assigned_to: teammateA.id,
      },
    })

    const companyB = await tx.company.create({
      data: {
        workspaceId: owner.workspaceId,
        name: 'Artemis Retail',
        website: 'https://artemis-retail.example',
        industry: 'Retail',
        size: '201-500',
        location: 'Cluj-Napoca',
        status: CompanyStatus.LEAD,
        notes: 'Lead cald venit din recomandare.',
        created_by: owner.id,
        assigned_to: owner.id,
      },
    })

    const companyC = await tx.company.create({
      data: {
        workspaceId: owner.workspaceId,
        name: 'Delta Systems',
        website: 'https://delta-systems.example',
        industry: 'Software',
        size: '11-50',
        location: 'Iasi',
        status: CompanyStatus.PARTNER,
        notes: 'Partener tehnic pentru integrari.',
        created_by: owner.id,
        assigned_to: teammateB.id,
      },
    })

    const contactA1 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyA.id,
        first_name: 'Mihai',
        last_name: 'Dumitrescu',
        email: 'mihai.dumitrescu@novalogistics.example',
        phone: '+40 723 111 001',
        job_title: 'Head of Operations',
        status: ContactStatus.CUSTOMER,
        tags: ['enterprise', 'operations'],
        notes: 'Decident principal pe partea operationala.',
        created_by: owner.id,
        assigned_to: teammateA.id,
      },
    })

    const contactA2 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyA.id,
        first_name: 'Andreea',
        last_name: 'Stan',
        email: 'andreea.stan@novalogistics.example',
        phone: '+40 723 111 002',
        job_title: 'Finance Manager',
        status: ContactStatus.PROSPECT,
        tags: ['finance'],
        notes: 'Interesata de raportare avansata.',
        created_by: owner.id,
        assigned_to: owner.id,
      },
    })

    const contactB1 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyB.id,
        first_name: 'Radu',
        last_name: 'Matei',
        email: 'radu.matei@artemis-retail.example',
        phone: '+40 723 222 001',
        job_title: 'CEO',
        status: ContactStatus.LEAD,
        tags: ['decision-maker', 'vip'],
        notes: 'A cerut demo personalizat.',
        created_by: owner.id,
        assigned_to: owner.id,
      },
    })

    const contactB2 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyB.id,
        first_name: 'Laura',
        last_name: 'Neagu',
        email: 'laura.neagu@artemis-retail.example',
        phone: '+40 723 222 002',
        job_title: 'Marketing Director',
        status: ContactStatus.PROSPECT,
        tags: ['marketing'],
        notes: 'Interesata de automatizari de campanii.',
        created_by: owner.id,
        assigned_to: teammateA.id,
      },
    })

    const contactC1 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyC.id,
        first_name: 'Elena',
        last_name: 'Marin',
        email: 'elena.marin@delta-systems.example',
        phone: '+40 723 333 001',
        job_title: 'CTO',
        status: ContactStatus.PARTNER,
        tags: ['technical'],
        notes: 'Coordoneaza integrarea API.',
        created_by: owner.id,
        assigned_to: teammateB.id,
      },
    })

    const contactC2 = await tx.contact.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyC.id,
        first_name: 'Paul',
        last_name: 'Roman',
        email: 'paul.roman@delta-systems.example',
        phone: '+40 723 333 002',
        job_title: 'Product Manager',
        status: ContactStatus.PROSPECT,
        tags: ['product'],
        notes: 'Vrea roadmap comun pe 6 luni.',
        created_by: owner.id,
        assigned_to: owner.id,
      },
    })

    await tx.company.update({
      where: { id: companyA.id },
      data: { primaryContactId: contactA1.id },
    })
    await tx.company.update({
      where: { id: companyB.id },
      data: { primaryContactId: contactB1.id },
    })
    await tx.company.update({
      where: { id: companyC.id },
      data: { primaryContactId: contactC1.id },
    })

    const dealA = await tx.deal.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyA.id,
        contactId: contactA1.id,
        title: 'Upsell licente anuale - Nova Logistics',
        description: 'Extindere de la 40 la 75 licente.',
        stage: DealStage.NEGOTIATION,
        value: 12000,
        expected_close: new Date(Date.now() + 1000 * 60 * 60 * 24 * 9),
        ownerId: teammateA.id,
        created_by: owner.id,
      },
    })

    const dealB = await tx.deal.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyB.id,
        contactId: contactB1.id,
        title: 'Implementare CRM completa - Artemis Retail',
        description: 'Pachet implementation + training.',
        stage: DealStage.PROPOSAL,
        value: 34000,
        expected_close: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18),
        ownerId: owner.id,
        created_by: owner.id,
      },
    })

    const dealC = await tx.deal.create({
      data: {
        workspaceId: owner.workspaceId,
        companyId: companyC.id,
        contactId: contactC1.id,
        title: 'Parteneriat integrare API',
        description: 'Revenue share pentru clienti comuni.',
        stage: DealStage.QUALIFIED,
        value: 22000,
        expected_close: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25),
        ownerId: teammateB.id,
        created_by: owner.id,
      },
    })

    const task1 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: onboardingProject.id,
        title: 'Pregateste demo custom pentru Artemis Retail',
        notes: 'Include dashboard de vanzari + pipeline CRM.',
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        reminder_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
        priority: 3,
        status: TaskStatus.IN_PROGRESS,
        task_type: TaskType.MEETING,
        responsible: owner.name,
        contactId: contactB1.id,
        companyId: companyB.id,
        dealId: dealB.id,
      },
    })

    const task2 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: retentionProject.id,
        title: 'Follow-up renegociere contract Nova Logistics',
        notes: 'Discutie pe volum licente trimestriale.',
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        priority: 2,
        status: TaskStatus.ACTIVE,
        task_type: TaskType.CALL,
        responsible: teammateA.name,
        contactId: contactA1.id,
        companyId: companyA.id,
        dealId: dealA.id,
      },
    })

    const task3 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: inboxProject.id,
        title: 'Trimite propunerea finala catre Artemis',
        notes: 'Ataseaza oferta cu discount pe 12 luni.',
        due_at: new Date(Date.now() - 1000 * 60 * 60 * 12),
        priority: 3,
        status: TaskStatus.COMPLETED,
        task_type: TaskType.EMAIL,
        completed_at: new Date(Date.now() - 1000 * 60 * 60 * 6),
        responsible: owner.name,
        contactId: contactB2.id,
        companyId: companyB.id,
        dealId: dealB.id,
      },
    })

    const task4 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: retentionProject.id,
        title: 'Plan de onboarding pentru 3 clienti noi',
        notes: 'Checklist tehnic + training.',
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
        priority: 2,
        status: TaskStatus.ACTIVE,
        task_type: TaskType.ADMIN,
        responsible: teammateB.name,
      },
    })

    const task5 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: onboardingProject.id,
        title: 'Sesiune tehnica integrare API cu Delta Systems',
        notes: 'Review endpoint-uri si throttling.',
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
        priority: 1,
        status: TaskStatus.ACTIVE,
        task_type: TaskType.MEETING,
        responsible: teammateB.name,
        contactId: contactC1.id,
        companyId: companyC.id,
        dealId: dealC.id,
      },
    })

    const task6 = await tx.task.create({
      data: {
        userId: owner.id,
        workspaceId: owner.workspaceId,
        projectId: inboxProject.id,
        title: 'Curata pipeline-ul de lead-uri inactive',
        notes: 'Marcheaza contactele fara activitate in 90 zile.',
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        priority: 1,
        status: TaskStatus.ACTIVE,
        task_type: TaskType.OTHER,
        responsible: owner.name,
      },
    })

    await tx.subTask.createMany({
      data: [
        { taskId: task1.id, title: 'Verifica datele de vanzari importate', order: 1 },
        { taskId: task1.id, title: 'Pregateste 5 scenarii de demo', order: 2 },
        { taskId: task1.id, title: 'Confirma participanti pe calendar', order: 3, completed: true, completed_at: new Date() },
        { taskId: task2.id, title: 'Actualizeaza forecast-ul in CRM', order: 1 },
        { taskId: task2.id, title: 'Stabileste call-ul cu CFO', order: 2 },
        { taskId: task5.id, title: 'Trimite documentatia API', order: 1, completed: true, completed_at: new Date() },
      ],
    })

    await tx.taskTag.createMany({
      data: [
        { taskId: task1.id, tagId: tags[0].id },
        { taskId: task1.id, tagId: tags[2].id },
        { taskId: task2.id, tagId: tags[1].id },
        { taskId: task2.id, tagId: tags[3].id },
        { taskId: task3.id, tagId: tags[1].id },
        { taskId: task4.id, tagId: tags[3].id },
        { taskId: task5.id, tagId: tags[2].id },
        { taskId: task6.id, tagId: tags[1].id },
      ],
    })

    await tx.comment.createMany({
      data: [
        {
          taskId: task1.id,
          userId: owner.id,
          content: 'Am pregatit deja structura pentru demo, mai lipseste validarea datelor.',
          mentions: [teammateA.id],
        },
        {
          taskId: task2.id,
          userId: teammateA.id,
          content: 'Clientul e disponibil luni la 10:00 pentru renegociere.',
          mentions: [owner.id],
        },
      ],
    })

    await tx.cRMNote.createMany({
      data: [
        {
          workspaceId: owner.workspaceId,
          authorId: owner.id,
          content: 'Artemis vrea discount doar daca include training extins.',
          contactId: contactB1.id,
          companyId: companyB.id,
          dealId: dealB.id,
          taskId: task1.id,
        },
        {
          workspaceId: owner.workspaceId,
          authorId: teammateB.id,
          content: 'Delta Systems poate livra integrarea in 2 sprint-uri.',
          contactId: contactC1.id,
          companyId: companyC.id,
          dealId: dealC.id,
          taskId: task5.id,
        },
      ],
    })

    await tx.interaction.createMany({
      data: [
        {
          workspaceId: owner.workspaceId,
          authorId: owner.id,
          type: 'MEETING',
          subject: 'Demo kick-off Artemis',
          content: 'Am prezentat dashboard-ul si pipeline-ul de deal-uri.',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 30),
          contactId: contactB1.id,
          companyId: companyB.id,
          dealId: dealB.id,
          taskId: task1.id,
        },
        {
          workspaceId: owner.workspaceId,
          authorId: teammateA.id,
          type: 'CALL',
          subject: 'Renegociere Nova Logistics',
          content: 'Au cerut propunere cu 10% discount pe volum mare.',
          happened_at: new Date(Date.now() - 1000 * 60 * 60 * 20),
          contactId: contactA1.id,
          companyId: companyA.id,
          dealId: dealA.id,
          taskId: task2.id,
        },
      ],
    })

    await tx.activity.createMany({
      data: [
        {
          workspaceId: owner.workspaceId,
          userId: owner.id,
          taskId: task1.id,
          projectId: onboardingProject.id,
          type: 'TASK_CREATED',
          description: 'Task nou pentru demo Artemis Retail',
        },
        {
          workspaceId: owner.workspaceId,
          userId: teammateA.id,
          taskId: task2.id,
          projectId: retentionProject.id,
          type: 'COMMENT_ADDED',
          description: 'Comentariu adaugat pe taskul de renegociere.',
        },
      ],
    })

    await tx.taskTemplate.createMany({
      data: [
        {
          userId: owner.id,
          workspaceId: owner.workspaceId,
          name: 'Template onboarding client',
          description: 'Pasii standard dupa semnarea contractului.',
          title: 'Onboarding client nou',
          notes: 'Config initial + training + follow-up.',
          priority: 2,
          responsible: teammateB.name,
          subtasks: JSON.stringify(['Kickoff call', 'Import date', 'Training utilizatori']),
          tagIds: JSON.stringify([tags[2].id, tags[3].id]),
        },
        {
          userId: owner.id,
          workspaceId: owner.workspaceId,
          name: 'Template follow-up deal',
          description: 'Workflow de follow-up dupa oferta trimisa.',
          title: 'Follow-up oferta',
          notes: 'Call + email recap + reminder intern.',
          priority: 3,
          responsible: owner.name,
          subtasks: JSON.stringify(['Call initial', 'Trimite email recap', 'Seteaza reminder']),
          tagIds: JSON.stringify([tags[1].id, tags[0].id]),
        },
      ],
    })

    await tx.filterPreset.create({
      data: {
        userId: owner.id,
        name: 'Urgente + deadline 7 zile',
        filters: JSON.stringify({
          statuses: ['ACTIVE', 'IN_PROGRESS'],
          priorities: [2, 3],
          dueWithinDays: 7,
        }),
      },
    })

    await tx.notification.createMany({
      data: [
        {
          userId: owner.id,
          type: 'TASK_ASSIGNED',
          title: 'Task urgent',
          message: 'Demo Artemis Retail este programat peste 2 zile.',
          link: '/app/tasks',
        },
        {
          userId: owner.id,
          type: 'DEAL_UPDATE',
          title: 'Deal in negociere',
          message: 'Nova Logistics a cerut o varianta noua de pricing.',
          link: '/app/crm/deals',
        },
      ],
    })

    await tx.emailNotificationSettings.upsert({
      where: { userId: owner.id },
      create: {
        userId: owner.id,
        upcomingTaskEmail: true,
        overdueTaskEmail: true,
        dailyDigestEmail: true,
        digestHourUtc: 7,
        followUpReminderEmail: true,
      },
      update: {
        upcomingTaskEmail: true,
        overdueTaskEmail: true,
        dailyDigestEmail: true,
        digestHourUtc: 7,
        followUpReminderEmail: true,
      },
    })
  })

  process.stdout.write('\nSeed completed successfully.\n')
  process.stdout.write(`Demo user: ${DEMO_USER_EMAIL}\n`)
  process.stdout.write(`Demo password: ${DEMO_USER_PASSWORD}\n`)
  process.stdout.write('Workspace: Demo CRM Workspace\n\n')
}

seed()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
