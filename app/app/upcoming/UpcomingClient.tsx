'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import TaskItem from '@/components/TaskItem'
import { Task, Project } from '@/types'

interface UpcomingClientProps {
  projects: Project[]
  tasks: Task[]
}

export default function UpcomingClient({ projects, tasks }: UpcomingClientProps) {
  // Group tasks by project and compute projects with tasks
  const { tasksByProject, tasksWithoutProject, projectsWithTasks } = useMemo(() => {
    const tasksByProject = new Map<string, Task[]>()
    const tasksWithoutProject: Task[] = []

    tasks.forEach((task) => {
      if (task.projectId && task.project) {
        if (!tasksByProject.has(task.projectId)) {
          tasksByProject.set(task.projectId, [])
        }
        tasksByProject.get(task.projectId)!.push(task)
      } else {
        tasksWithoutProject.push(task)
      }
    })

    const projectsWithTasks = projects.filter((project) => 
      tasksByProject.has(project.id)
    )

    return { tasksByProject, tasksWithoutProject, projectsWithTasks }
  }, [projects, tasks])

  // Expand all projects by default
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    new Set(projectsWithTasks.map((p) => p.id))
  )

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        throw new Error('Failed to update task')
      }
    } catch (error) {
      // Error updating task
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete task')
      }
    } catch (error) {
      // Error deleting task
    }
  }

  return (
    <div className="space-y-6">
      {/* Projects with tasks */}
      {projectsWithTasks.map((project) => {
        const projectTasks = tasksByProject.get(project.id) || []
        const isExpanded = expandedProjects.has(project.id)

        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleProject(project.id)}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
              <Folder
                className="w-5 h-5"
                style={{
                  color: project.color || '#6b7280',
                }}
              />
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {projectTasks.length} {projectTasks.length === 1 ? 'sarcină activă' : 'sarcini active'}
                </p>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-2 bg-white dark:bg-gray-800">
                    {projectTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onUpdate={handleTaskUpdate}
                        onDelete={handleTaskDelete}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      {/* Tasks without project */}
      {tasksWithoutProject.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Fără proiect</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tasksWithoutProject.length} {tasksWithoutProject.length === 1 ? 'sarcină activă' : 'sarcini active'}
            </p>
          </div>
          <div className="p-4 space-y-2 bg-white dark:bg-gray-800">
            {tasksWithoutProject.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {projectsWithTasks.length === 0 && tasksWithoutProject.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Nu există sarcini active</p>
        </div>
      )}
    </div>
  )
}

