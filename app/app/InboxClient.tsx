'use client'

import { useState, useEffect } from 'react'
import { Check, X, Users, Mail } from 'lucide-react'
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
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
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
          setNotifications(data.notifications || [])
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
        setNotifications((prev) =>
          prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif))
        )
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

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {notifications.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Notificări
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                  notification.read
                    ? 'border-gray-200 dark:border-gray-700 opacity-75'
                    : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{notification.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {new Date(notification.created_at).toLocaleString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

