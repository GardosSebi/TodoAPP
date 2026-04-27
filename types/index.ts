export interface User {
  id: string
  email: string
  name: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  userId: string
  name: string
  color: string | null
  archived?: boolean
  completed?: boolean
  order?: number
  created_at: string
  updated_at: string
  workspace?: {
    id: string
    name: string
    userId: string
  }
  _count?: {
    tasks: number
  }
}

export interface TaskFile {
  id: string
  taskId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploaded_at: string
}

export interface SubTask {
  id: string
  taskId: string
  title: string
  completed: boolean
  order: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Tag {
  id: string
  workspaceId: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  userId: string
  projectId: string | null
  contactId?: string | null
  companyId?: string | null
  dealId?: string | null
  title: string
  notes: string | null
  due_at: string | null
  reminder_at?: string | null
  priority: number
  status: 'ACTIVE' | 'COMPLETED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED'
  task_type?: 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'PROPOSAL' | 'ADMIN' | 'OTHER' | null
  completed_at: string | null
  responsible: string | null
  archived?: boolean
  created_at: string
  updated_at: string
  project: Project | null
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    status: 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'INACTIVE'
  } | null
  company?: {
    id: string
    name: string
    status: 'LEAD' | 'ACTIVE_CUSTOMER' | 'PAST_CUSTOMER' | 'PARTNER' | 'INACTIVE'
  } | null
  deal?: {
    id: string
    title: string
    stage: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
    value: number
  } | null
  files?: TaskFile[]
  subtasks?: SubTask[]
  tags?: Tag[]
}

export interface TaskTemplate {
  id: string
  userId: string
  workspaceId: string
  name: string
  description: string | null
  title: string
  notes: string | null
  priority: number
  responsible: string | null
  subtasks: string[]
  tagIds: string[]
  created_at: string
  updated_at: string
}

