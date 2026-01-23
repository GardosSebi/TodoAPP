'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Trash2, Calendar, Flag, User } from 'lucide-react'
import { Task } from '@/types'
import { formatDate, isOverdue, isToday } from '@/lib/utils'
import TaskDetailsModal from './TaskDetailsModal'

interface TaskItemProps {
  task: Task
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onDelete: (taskId: string) => void
  onClick?: (task: Task) => void
}

export default function TaskItem({ task, onUpdate, onDelete, onClick }: TaskItemProps) {
  const [showDetails, setShowDetails] = useState(false)

  const handleToggleComplete = () => {
    onUpdate(task.id, {
      status: task.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE',
    })
  }

  const priorityColors = {
    0: 'text-gray-400',
    1: 'text-blue-500',
    2: 'text-yellow-500',
    3: 'text-red-500',
  }

  const dueDate = task.due_at ? new Date(task.due_at) : null
  const overdue = dueDate && isOverdue(dueDate) && task.status === 'ACTIVE'
  const today = dueDate && isToday(dueDate)

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
          task.status === 'COMPLETED' ? 'opacity-60' : ''
        }`}
      >
        <button
          onClick={handleToggleComplete}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.status === 'COMPLETED'
              ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
          }`}
        >
          {task.status === 'COMPLETED' && (
            <Check className="w-3 h-3 text-white" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => {
            if (onClick) {
              onClick(task)
            } else {
              setShowDetails(true)
            }
          }}
        >
          <div className="flex items-center gap-2">
            <p
              className={`text-sm font-medium ${
                task.status === 'COMPLETED'
                  ? 'line-through text-gray-500 dark:text-gray-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {task.title}
            </p>
            {task.priority > 0 && (
              <Flag
                className={`w-4 h-4 ${priorityColors[task.priority as keyof typeof priorityColors]}`}
              />
            )}
          </div>
          {task.notes && (
            <p
              className={`text-xs mt-1 text-gray-600 dark:text-gray-300 line-clamp-2 ${
                task.status === 'COMPLETED' ? 'opacity-60' : ''
              }`}
            >
              {task.notes}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {task.project && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  task.project.color 
                    ? '' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white'
                }`}
                style={task.project.color ? {
                  backgroundColor: `${task.project.color}20`,
                  color: task.project.color,
                } : undefined}
              >
                {task.project.name}
              </span>
            )}
            {dueDate && (
              <span
                className={`text-xs flex items-center gap-1 ${
                  overdue
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : today
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDate(dueDate)}
                {overdue && ' (Întârziată)'}
              </span>
            )}
            {task.responsible && (
              <span className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <User className="w-3 h-3" />
                {task.responsible}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </motion.div>

      {showDetails && !onClick && (
        <TaskDetailsModal
          task={task}
          onClose={() => setShowDetails(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </>
  )
}

