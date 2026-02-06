'use client'

import KanbanBoard from '@/components/KanbanBoard'
import QuickAddTask from '@/components/QuickAddTask'
import TaskDetailsModal from '@/components/TaskDetailsModal'
import SearchBar from '@/components/SearchBar'
import AdvancedFilters from '@/components/AdvancedFilters'
import ImportTasksModal from '@/components/ImportTasksModal'
import { Task, Tag } from '@/types'
import { useState, useEffect } from 'react'
import { Upload } from 'lucide-react'

interface ProjectClientProps {
  initialTasks: Task[]
  projectId: string
  projectName: string
}

export default function ProjectClient({ initialTasks, projectId, projectName }: ProjectClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filteredTasks, setFilteredTasks] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState<any>({})
  const [projects, setProjects] = useState<any[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchWorkspaceMembers()
    fetchTags()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [tasks, filters])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      // Error fetching projects
    }
  }

  const fetchWorkspaceMembers = async () => {
    try {
      const res = await fetch('/api/workspace/members')
      if (res.ok) {
        const data = await res.json()
        setWorkspaceMembers(data.members || [])
      }
    } catch (error) {
      // Error fetching workspace members
    }
  }

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      // Error fetching tags
    }
  }

  const applyFilters = () => {
    let filtered = [...tasks]

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchLower) ||
          (task.notes && task.notes.toLowerCase().includes(searchLower))
      )
    }

    // Apply priority filter
    if (filters.priority !== undefined) {
      filtered = filtered.filter((task) => task.priority === filters.priority)
    }

    // Apply responsible filter
    if (filters.responsible) {
      filtered = filtered.filter(
        (task) => task.responsible && task.responsible.toLowerCase().includes(filters.responsible.toLowerCase())
      )
    }

    // Apply date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter((task) => {
        if (!task.due_at) return false
        const taskDate = new Date(task.due_at)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          if (taskDate < fromDate) return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo)
          toDate.setHours(23, 59, 59, 999)
          if (taskDate > toDate) return false
        }
        return true
      })
    }

    // Apply tags filter
    if (filters.tagIds && filters.tagIds.length > 0) {
      filtered = filtered.filter((task) => {
        if (!task.tags || task.tags.length === 0) return false
        const taskTagIds = task.tags.map((tag) => tag.id)
        // Task must have at least one of the selected tags
        return filters.tagIds.some((tagId: string) => taskTagIds.includes(tagId))
      })
    }

    setFilteredTasks(filtered)
  }

  const handleAddTask = async (title: string, description?: string, deadline?: string, priority?: number) => {
    try {
      let dueAt: string | null = null
      if (deadline) {
        const date = new Date(deadline)
        date.setHours(23, 59, 59, 999)
        dueAt = date.toISOString()
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title,
          projectId,
          notes: description || null,
          due_at: dueAt,
          priority: priority !== undefined ? priority : 0
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // Set new tasks to NOT_STARTED by default
        const newTask = { ...data.task, status: 'NOT_STARTED' as const }
        setTasks((prev) => [newTask, ...prev])
        // Refresh filtered tasks will happen automatically via useEffect
      }
    } catch (error) {
      // Error('Error creating task:', error)
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    )

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        // Revert on error
        setTasks(initialTasks)
        throw new Error('Failed to update task')
      }

      const data = await res.json()
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? data.task : task))
      )
    } catch (error) {
      // Error('Error updating task:', error)
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) => prev.filter((task) => task.id !== taskId))

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        // Revert on error
        setTasks(initialTasks)
        throw new Error('Failed to delete task')
      }
    } catch (error) {
      // Error('Error deleting task:', error)
    }
  }

  const handleImportTasks = async (importTasks: Array<{
    titlu: string
    termen: string
    prioritate: string | number
    descriere: string
  }>) => {
    try {
      const res = await fetch('/api/tasks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          tasks: importTasks.map((task) => ({
            title: task.titlu,
            notes: task.descriere || null,
            due_at: task.termen || null,
            priority: typeof task.prioritate === 'number' ? task.prioritate : parseInt(String(task.prioritate)) || 0,
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to import tasks')
      }

      const data = await res.json()
      
      // Add imported tasks to state
      const newTasks = data.tasks.map((task: any) => ({
        ...task,
        status: 'NOT_STARTED' as const,
        due_at: task.due_at || null,
        completed_at: task.completed_at || null,
        created_at: task.created_at,
        updated_at: task.updated_at,
      }))
      
      setTasks((prev) => [...newTasks, ...prev])
      
      // Refresh page to get full task data
      window.location.reload()
    } catch (error: any) {
      throw error
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">{projectName}</h1>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
          {Object.keys(filters).length > 0 ? (
            <>
              {filteredTasks.length} din {tasks.length} {tasks.length === 1 ? 'sarcină' : 'sarcini'}
            </>
          ) : (
            <>
              {tasks.length} {tasks.length === 1 ? 'sarcină' : 'sarcini'}
            </>
          )}
        </p>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <QuickAddTask onAdd={handleAddTask} projectId={projectId} placeholder="Adaugă o sarcină la acest proiect..." />
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Upload className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Import Sarcini</span>
          <span className="sm:hidden">Import</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 md:mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 w-full">
            <SearchBar />
          </div>
          <AdvancedFilters
            onFiltersChange={setFilters}
            projects={projects}
            workspaceMembers={workspaceMembers}
            tags={tags}
          />
        </div>
      </div>

      <div className="mb-6">
        <KanbanBoard
          tasks={filteredTasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskClick={setSelectedTask}
        />
      </div>

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      <ImportTasksModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportTasks}
        projectId={projectId}
      />
    </div>
  )
}

