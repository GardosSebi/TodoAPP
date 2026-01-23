'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Task } from '@/types'
import { Flag, Calendar, MoreVertical, User } from 'lucide-react'
import { formatDate, isOverdue } from '@/lib/utils'

interface KanbanBoardProps {
  tasks: Task[]
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onTaskClick?: (task: Task) => void
}

type KanbanStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED'

const statusConfig = {
  NOT_STARTED: {
    label: 'Neînceput',
    color: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    textColor: 'text-gray-700 dark:text-gray-200',
  },
  IN_PROGRESS: {
    label: 'În Progres',
    color: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-700',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  FINISHED: {
    label: 'Finalizat',
    color: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-300 dark:border-green-700',
    textColor: 'text-green-700 dark:text-green-300',
  },
}

export default function KanbanBoard({
  tasks,
  onTaskUpdate,
  onTaskClick,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<KanbanStatus | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)

  // Group tasks by status
  const tasksByStatus = {
    NOT_STARTED: tasks.filter(
      (task) => task.status === 'NOT_STARTED' || (task.status === 'ACTIVE' && !task.completed_at)
    ),
    IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS'),
    FINISHED: tasks.filter(
      (task) => task.status === 'FINISHED' || task.status === 'COMPLETED'
    ),
  }

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault()
    setDraggedOverColumn(status)
  }

  const handleDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedTask) return

    const newStatus = status === 'FINISHED' ? 'COMPLETED' : status
    const updates: Partial<Task> = {
      status: newStatus as any,
    }

    if (status === 'FINISHED' && draggedTask.status !== 'COMPLETED') {
      updates.completed_at = new Date().toISOString()
    } else if (status !== 'FINISHED' && draggedTask.status === 'COMPLETED') {
      updates.completed_at = null
    }

    onTaskUpdate(draggedTask.id, updates)
    setDraggedTask(null)
    setDraggedOverColumn(null)
    dragStartPos.current = null
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDraggedOverColumn(null)
    dragStartPos.current = null
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3:
        return 'text-red-600 dark:text-red-400'
      case 2:
        return 'text-yellow-600 dark:text-yellow-400'
      case 1:
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-400 dark:text-gray-500'
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {(['NOT_STARTED', 'IN_PROGRESS', 'FINISHED'] as KanbanStatus[]).map((status) => {
        const config = statusConfig[status]
        const columnTasks = tasksByStatus[status]
        const isDraggedOver = draggedOverColumn === status

        return (
          <div
            key={status}
            className={`
              flex flex-col rounded-lg border-2 transition-colors
              ${isDraggedOver ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/40' : config.borderColor + ' ' + config.color}
            `}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className={`p-4 border-b ${config.borderColor} rounded-t-lg`}>
              <h3 className={`font-semibold ${config.textColor}`}>
                {config.label} ({columnTasks.length})
              </h3>
            </div>

            {/* Tasks */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
              <AnimatePresence>
                {columnTasks.map((task) => {
                  const dueDate = task.due_at ? new Date(task.due_at) : null
                  const overdue = dueDate && isOverdue(dueDate) && status !== 'FINISHED'

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        // Only trigger click if we didn't just drag
                        if (dragStartPos.current) {
                          const moved = Math.abs(e.clientX - dragStartPos.current.x) > 5 || 
                                       Math.abs(e.clientY - dragStartPos.current.y) > 5
                          if (!moved) {
                            onTaskClick?.(task)
                          }
                        } else {
                          onTaskClick?.(task)
                        }
                      }}
                      className={`
                        bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-3
                        cursor-move hover:shadow-md dark:hover:shadow-lg transition-shadow select-none
                        ${overdue ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/30' : ''}
                        ${draggedTask?.id === task.id ? 'opacity-50' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.priority > 0 && (
                              <Flag
                                className={`w-4 h-4 ${getPriorityColor(task.priority)}`}
                              />
                            )}
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {task.title}
                            </h4>
                          </div>
                          {task.notes && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                              {task.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {dueDate && (
                              <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(dueDate)}
                                {overdue && ' (Întârziată)'}
                              </div>
                            )}
                            {task.project && (
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
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
                            {task.responsible && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{task.responsible}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  Fără sarcini
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

