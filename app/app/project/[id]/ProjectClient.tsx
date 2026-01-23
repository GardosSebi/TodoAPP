'use client'

import KanbanBoard from '@/components/KanbanBoard'
import QuickAddTask from '@/components/QuickAddTask'
import TaskDetailsModal from '@/components/TaskDetailsModal'
import SearchBar from '@/components/SearchBar'
import AdvancedFilters from '@/components/AdvancedFilters'
import { Task } from '@/types'
import { useState, useEffect } from 'react'

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

  useEffect(() => {
    fetchProjects()
    fetchWorkspaceMembers()
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
      console.error('Error fetching projects:', error)
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
      console.error('Error fetching workspace members:', error)
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

      <div className="mb-4">
        <QuickAddTask onAdd={handleAddTask} projectId={projectId} placeholder="Adaugă o sarcină la acest proiect..." />
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
    </div>
  )
}

