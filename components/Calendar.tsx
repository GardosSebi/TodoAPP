'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Task } from '@/types'
import { motion } from 'framer-motion'

interface CalendarProps {
  tasks: Task[]
  onDateClick?: (date: Date) => void
  onTaskClick?: (task: Task) => void
}

export default function Calendar({ tasks, onDateClick, onTaskClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  // Get previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  // Get next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    tasks.forEach((task) => {
      if (task.due_at) {
        const date = new Date(task.due_at)
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(task)
      }
    })
    return grouped
  }, [tasks])

  // Get tasks for a specific date
  const getTasksForDate = (day: number): Task[] => {
    const dateKey = `${year}-${month}-${day}`
    return tasksByDate[dateKey] || []
  }

  // Check if date is today
  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  // Check if date is in the past
  const isPast = (day: number): boolean => {
    const date = new Date(year, month, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const monthNames = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ]

  const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

  // Create calendar days
  const calendarDays = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Luna anterioară"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Luna următoare"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1 md:py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const dayTasks = getTasksForDate(day)
          const isTodayDate = isToday(day)
          const isPastDate = isPast(day)

          return (
            <motion.button
              key={day}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => {
                if (onDateClick) {
                  onDateClick(new Date(year, month, day))
                }
              }}
              className={`
                aspect-square p-2 rounded-lg border transition-all
                ${isTodayDate
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 font-semibold'
                  : isPastDate
                    ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
                ${onDateClick ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <div className="flex flex-col h-full">
                <span
                  className={`
                    text-sm mb-1
                    ${isTodayDate ? 'text-blue-700 dark:text-blue-300' : isPastDate ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}
                  `}
                >
                  {day}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onTaskClick) {
                          onTaskClick(task)
                        }
                      }}
                      className={`
                        text-xs px-1.5 py-0.5 rounded truncate text-left
                        transition-colors
                        ${task.priority === 3
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/70'
                          : task.priority === 2
                            ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
                            : task.priority === 1
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/70'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                        ${onTaskClick ? 'cursor-pointer' : 'cursor-default'}
                      `}
                      title={task.title}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          if (onTaskClick) {
                            onTaskClick(task)
                          }
                        }
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 px-1.5">
                      +{dayTasks.length - 3} în plus
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700"></div>
            <span className="text-gray-600 dark:text-gray-300">Prioritate Ridicată</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700"></div>
            <span className="text-gray-600 dark:text-gray-300">Prioritate Medie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700"></div>
            <span className="text-gray-600 dark:text-gray-300">Prioritate Scăzută</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"></div>
            <span className="text-gray-600 dark:text-gray-300">Fără Prioritate</span>
          </div>
        </div>
      </div>
    </div>
  )
}

