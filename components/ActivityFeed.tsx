'use client'

import { useState, useEffect } from 'react'
import { Activity as ActivityIcon, User, FileText, Folder, MessageSquare } from 'lucide-react'

const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'acum'
  if (diffInSeconds < 3600) return `acum ${Math.floor(diffInSeconds / 60)} min`
  if (diffInSeconds < 86400) return `acum ${Math.floor(diffInSeconds / 3600)} ore`
  if (diffInSeconds < 604800) return `acum ${Math.floor(diffInSeconds / 86400)} zile`
  
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Activity {
  id: string
  type: string
  description: string
  metadata: any
  created_at: string
  user: {
    id: string
    name: string
    email: string
  }
  task?: {
    id: string
    title: string
  }
}

interface ActivityFeedProps {
  workspaceId?: string
  taskId?: string
  projectId?: string
  limit?: number
}

const activityIcons: Record<string, any> = {
  TASK_CREATED: FileText,
  TASK_UPDATED: FileText,
  TASK_COMPLETED: FileText,
  COMMENT_ADDED: MessageSquare,
  PROJECT_CREATED: Folder,
}

const activityColors: Record<string, string> = {
  TASK_CREATED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  TASK_UPDATED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  TASK_COMPLETED: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  COMMENT_ADDED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  PROJECT_CREATED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
}

export default function ActivityFeed({
  workspaceId,
  taskId,
  projectId,
  limit = 20,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchActivities()
  }, [workspaceId, taskId, projectId])

  const fetchActivities = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (workspaceId) params.append('workspaceId', workspaceId)
      if (taskId) params.append('taskId', taskId)
      if (projectId) params.append('projectId', projectId)
      params.append('limit', limit.toString())

      const res = await fetch(`/api/activity?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        Se încarcă activitățile...
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
        Nu există activități recente
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <ActivityIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Activitate Recentă</h3>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type] || ActivityIcon
          const colorClass = activityColors[activity.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${colorClass} flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {activity.user.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeAgo(new Date(activity.created_at))}
                  </span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {activity.description}
                </div>
                {activity.task && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Sarcină: {activity.task.title}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

