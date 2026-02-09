'use client'

import { useState, useEffect } from 'react'
import { Check, X, Users, Mail, AtSign, UserCheck, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import TaskList from '@/components/TaskList'
import TaskDetailsModal from '@/components/TaskDetailsModal'
import { Task } from '@/types'

interface Invitation {
  id: string
  workspace: {
    id: string
    name: string
  }
  inviter: {
    id: string
    email: string
    name: string
  }
  status: string
  created_at: string
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

interface InboxClientProps {
  initialTasks: any[]
  initialInvitations: Invitation[]
  initialNotifications: Notification[]
}

export default function InboxClient({ initialTasks, initialInvitations, initialNotifications }: InboxClientProps) {
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations)
  // Sort initial notifications by date (most recent first)
  const sortedInitialNotifications = [...initialNotifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const [notifications, setNotifications] = useState<Notification[]>(sortedInitialNotifications)
  const [notificationFilters, setNotificationFilters] = useState<string[]>([]) // Array of selected filter types, empty = all
  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const router = useRouter()

  // Fetch notifications periodically and on visibility change
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?limit=50')
        if (res.ok) {
          const data = await res.json()
          // Sort notifications by date (most recent first)
          const sorted = (data.notifications || []).sort(
            (a: Notification, b: Notification) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setNotifications(sorted)
        }
      } catch (error) {
        // Error fetching notifications
      }
    }

    // Fetch on mount
    fetchNotifications()

    // Refetch when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    // TaskList handles its own updates
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates })
    }
  }

  const handleTaskDelete = async (taskId: string) => {
    if (selectedTask?.id === taskId) {
      setSelectedTask(null)
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    setProcessing(invitationId)
    try {
      const res = await fetch(`/api/workspace/invitations/${invitationId}`, {
        method: 'POST',
      })

      if (res.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
        // Refresh the page to update workspace data
        router.refresh()
      } else {
        let errorMessage = 'Eroare la acceptarea invitației'
        try {
          const contentType = res.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } else {
            const text = await res.text()
            errorMessage = text || errorMessage
          }
        } catch (parseError) {
          // Error parsing response
        }
        alert(errorMessage)
      }
    } catch (error) {
      alert('Eroare la acceptarea invitației')
    } finally {
      setProcessing(null)
    }
  }

  const handleDenyInvitation = async (invitationId: string) => {
    if (!confirm('Ești sigur că vrei să respingi această invitație?')) {
      return
    }

    setProcessing(invitationId)
    try {
      const res = await fetch(`/api/workspace/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
      } else {
        let errorMessage = 'Eroare la respingerea invitației'
        try {
          const contentType = res.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } else {
            const text = await res.text()
            errorMessage = text || errorMessage
          }
        } catch (parseError) {
          // Error parsing response
        }
        alert(errorMessage)
      }
    } catch (error) {
      alert('Eroare la respingerea invitației')
    } finally {
      setProcessing(null)
    }
  }

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationIds: [notificationId],
          read: true,
        }),
      })

      if (res.ok) {
        setNotifications((prev) => {
          const updated = prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif))
          // Maintain sort order by date
          return updated.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        })
        // Emit custom event to update sidebar notification count
        window.dispatchEvent(new CustomEvent('notificationRead'))
      }
    } catch (error) {
      // Error marking notification as read
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      handleMarkNotificationRead(notification.id)
    }

    // Navigate to link if available
    if (notification.link) {
      router.push(notification.link)
    }
  }

  // Group notifications by date
  const groupNotificationsByDate = (notifications: Notification[]) => {
    const grouped: { [key: string]: Notification[] } = {}
    
    notifications
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((notification) => {
        const date = new Date(notification.created_at)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        let dateKey: string
        const dateStr = date.toDateString()
        const todayStr = today.toDateString()
        const yesterdayStr = yesterday.toDateString()
        
        if (dateStr === todayStr) {
          dateKey = 'ASTĂZI'
        } else if (dateStr === yesterdayStr) {
          dateKey = 'IERI'
        } else {
          dateKey = date.toLocaleDateString('ro-RO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        }
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(notification)
      })
    
    return grouped
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter notifications based on selected filters
  const filteredNotifications = notificationFilters.length > 0
    ? notifications.filter((n) => notificationFilters.includes(n.type))
    : notifications

  const groupedNotifications = groupNotificationsByDate(filteredNotifications)
  const unreadCount = notifications.filter((n) => !n.read).length
  
  // Count notifications by type
  const mentionCount = notifications.filter((n) => n.type === 'MENTION').length
  const assignmentCount = notifications.filter((n) => n.type === 'TASK_ASSIGNED').length
  const completedCount = notifications.filter((n) => n.type === 'TASK_COMPLETED').length
  const dueSoonCount = notifications.filter((n) => n.type === 'TASK_DUE_SOON').length
  const overdueCount = notifications.filter((n) => n.type === 'TASK_OVERDUE').length

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {notifications.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Notificări
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setNotificationFilters([])}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Toate
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 dark:bg-gray-700 rounded">
                {notifications.length}
              </span>
            </button>
            <button
              onClick={() => {
                const filterType = 'MENTION'
                setNotificationFilters((prev) =>
                  prev.includes(filterType)
                    ? prev.filter((f) => f !== filterType)
                    : [...prev, filterType]
                )
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.includes('MENTION')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <AtSign className="w-4 h-4" />
              Mențiuni
              {mentionCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  notificationFilters.includes('MENTION')
                    ? 'bg-white/20'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {mentionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                const filterType = 'TASK_ASSIGNED'
                setNotificationFilters((prev) =>
                  prev.includes(filterType)
                    ? prev.filter((f) => f !== filterType)
                    : [...prev, filterType]
                )
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.includes('TASK_ASSIGNED')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Atribuiri
              {assignmentCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  notificationFilters.includes('TASK_ASSIGNED')
                    ? 'bg-white/20'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {assignmentCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                const filterType = 'TASK_COMPLETED'
                setNotificationFilters((prev) =>
                  prev.includes(filterType)
                    ? prev.filter((f) => f !== filterType)
                    : [...prev, filterType]
                )
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.includes('TASK_COMPLETED')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Task Finalizate
              {completedCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  notificationFilters.includes('TASK_COMPLETED')
                    ? 'bg-white/20'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {completedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                const filterType = 'TASK_DUE_SOON'
                setNotificationFilters((prev) =>
                  prev.includes(filterType)
                    ? prev.filter((f) => f !== filterType)
                    : [...prev, filterType]
                )
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.includes('TASK_DUE_SOON')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              Termen Apropiat
              {dueSoonCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  notificationFilters.includes('TASK_DUE_SOON')
                    ? 'bg-white/20'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {dueSoonCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                const filterType = 'TASK_OVERDUE'
                setNotificationFilters((prev) =>
                  prev.includes(filterType)
                    ? prev.filter((f) => f !== filterType)
                    : [...prev, filterType]
                )
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                notificationFilters.includes('TASK_OVERDUE')
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Termen Depășit
              {overdueCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                  notificationFilters.includes('TASK_OVERDUE')
                    ? 'bg-white/20'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {overdueCount}
                </span>
              )}
            </button>
          </div>

          {filteredNotifications.length > 0 ? (
            <div className="space-y-8">
              {Object.entries(groupedNotifications).map(([dateKey, dayNotifications]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                    {dateKey}
                  </h3>
                  <div className="space-y-1">
                    {dayNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group flex items-start gap-4 p-3 rounded-lg cursor-pointer transition-all ${
                          notification.read
                            ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                      >
                        <div className="flex-shrink-0 w-16 text-right">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {formatTime(notification.created_at)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            {!notification.read && (
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></div>
                            )}
                            <div className="flex-1">
                              <h4 className={`text-sm font-medium ${
                                notification.read
                                  ? 'text-gray-700 dark:text-gray-300'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {notification.title}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Nu există notificări pentru filtrul selectat.</p>
            </div>
          )}
        </div>
      )}

      {invitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Invitații Workspace
          </h2>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {invitation.workspace.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invitație de la{' '}
                        {invitation.inviter.name || invitation.inviter.email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptInvitation(invitation.id)}
                    disabled={processing === invitation.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Acceptă
                  </button>
                  <button
                    onClick={() => handleDenyInvitation(invitation.id)}
                    disabled={processing === invitation.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Respinge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task List */}
      <TaskList
        initialTasks={initialTasks}
        view="inbox"
        onTaskClick={(task) => setSelectedTask(task)}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
      />

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

