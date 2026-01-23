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

export interface Task {
  id: string
  userId: string
  projectId: string | null
  title: string
  notes: string | null
  due_at: string | null
  priority: number
  status: 'ACTIVE' | 'COMPLETED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED'
  completed_at: string | null
  responsible: string | null
  created_at: string
  updated_at: string
  project: Project | null
  files?: TaskFile[]
}

