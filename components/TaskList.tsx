'use client'

import { useState, useOptimistic, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TaskItem from './TaskItem'
import { Task } from '@/types'

interface TaskListProps {
  initialTasks: Task[]
  view?: string
  onTaskClick?: (task: Task) => void
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => Promise<void>
  onTaskDelete?: (taskId: string) => void
}

export default function TaskList({ initialTasks, view, onTaskClick, onTaskUpdate, onTaskDelete }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  
  // Sync with parent when initialTasks change
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    tasks,
    (state, newTask: Task) => [...state, newTask]
  )

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    )

    if (onTaskUpdate) {
      await onTaskUpdate(taskId, updates)
      return
    }

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
      // Error updating task
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    // Get the task to find its projectId before deleting
    const taskToDelete = tasks.find((task) => task.id === taskId)
    const projectId = taskToDelete?.projectId || null

    // Optimistic update
    setTasks((prev) => prev.filter((task) => task.id !== taskId))

    if (onTaskDelete) {
      onTaskDelete(taskId)
      // Dispatch event to notify sidebar to update task counts
      window.dispatchEvent(new CustomEvent('taskDeleted', { 
        detail: { projectId } 
      }))
      return
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        // Revert on error
        setTasks(initialTasks)
        throw new Error('Failed to delete task')
      }
      
      // Dispatch event to notify sidebar to update task counts
      window.dispatchEvent(new CustomEvent('taskDeleted', { 
        detail: { projectId } 
      }))
    } catch (error) {
      // Error deleting task
    }
  }

  const handleTaskCreate = async (title: string, projectId?: string, priority: number = 0) => {
    const tempId = `temp-${Date.now()}`
    const newTask: Task = {
      id: tempId,
      title,
      notes: null,
      due_at: null,
      priority: priority,
      status: 'ACTIVE',
      completed_at: null,
      responsible: null,
      projectId: projectId || null,
      project: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      userId: '',
    }

    addOptimisticTask(newTask)

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          projectId: projectId || null,
          priority: priority,
        }),
      })

      if (!res.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== tempId))
        throw new Error('Failed to create task')
      }

      const data = await res.json()
      setTasks((prev) =>
        prev.map((task) => (task.id === tempId ? data.task : task))
      )
      
      // Dispatch event to notify sidebar to update task counts
      window.dispatchEvent(new CustomEvent('taskCreated', { 
        detail: { projectId: projectId || null } 
      }))
    } catch (error) {
      // Error creating task
      setTasks((prev) => prev.filter((task) => task.id !== tempId))
    }
  }

  const activeTasks = optimisticTasks.filter((task) => task.status === 'ACTIVE')
  const completedTasks = optimisticTasks.filter(
    (task) => task.status === 'COMPLETED'
  )

  // Don't show completed tasks in inbox view
  const shouldShowCompleted = view !== 'completed' && view !== 'inbox' && completedTasks.length > 0

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {activeTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {activeTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                onClick={onTaskClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTasks.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          
        </div>
      )}

      {shouldShowCompleted && (
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Finalizate ({completedTasks.length})
          </h3>
          <AnimatePresence>
            {completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                onClick={onTaskClick}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export { TaskList }
export type { TaskListProps }

