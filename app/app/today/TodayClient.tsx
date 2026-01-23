'use client'

import Calendar from '@/components/Calendar'
import TaskDetailsModal from '@/components/TaskDetailsModal'
import { Task } from '@/types'
import { useState, useEffect } from 'react'

interface TodayClientProps {
  initialTasks: Task[]
  monthTasks: Task[]
}

export default function TodayClient({ initialTasks, monthTasks }: TodayClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [allMonthTasks, setAllMonthTasks] = useState(monthTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Fetch all tasks with due dates when needed
  useEffect(() => {
    const fetchAllTasks = async () => {
      try {
        const res = await fetch('/api/tasks')
        if (res.ok) {
          const data = await res.json()
          // Filter to only tasks with due dates
          const tasksWithDueDates = (data.tasks || []).filter(
            (task: Task) => task.due_at !== null
          )
          setAllMonthTasks(tasksWithDueDates)
        }
      } catch (error) {
        // Error('Error fetching tasks for calendar:', error)
      }
    }

    // Fetch on mount to ensure we have all tasks
    fetchAllTasks()
  }, [])

  // Sync initialTasks when they change (e.g., on page refresh)
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  // Handle task click from calendar
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }

  // Handle task update from modal
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (res.ok) {
        const data = await res.json()
        const updatedTask = data.task

        // Update in today's tasks
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? updatedTask : task))
        )

        // Update in month tasks
        setAllMonthTasks((prev) =>
          prev.map((task) => (task.id === taskId ? updatedTask : task))
        )

        // Update selected task if it's the one being edited
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask)
        }
      }
    } catch (error) {
      // Error('Error updating task:', error)
    }
  }

  // Handle task deletion from modal
  const handleTaskDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Remove from today's tasks
        setTasks((prev) => prev.filter((task) => task.id !== taskId))

        // Remove from month tasks
        setAllMonthTasks((prev) => prev.filter((task) => task.id !== taskId))

        // Close modal
        setSelectedTask(null)
      }
    } catch (error) {
      // Error('Error deleting task:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">Calendar</h1>
      </div>

      <div className="mb-6">
        <Calendar tasks={allMonthTasks} onTaskClick={handleTaskClick} />
      </div>

      {/* Task Details Modal */}
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

