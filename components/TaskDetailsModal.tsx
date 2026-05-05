'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { X, Calendar, Flag, FileText, Upload, File, Trash2, User, Check, Plus, Tag as TagIcon, Archive, ArchiveRestore, Copy, MoreVertical, Building2, Handshake, Bell } from 'lucide-react'
import { Task, TaskFile, SubTask, Tag } from '@/types'
import { formatDate } from '@/lib/utils'
import CommentsSection from './CommentsSection'

interface WorkspaceMember {
  id: string
  userId: string
  role: string
  user: {
    id: string
    email: string
    name: string
  }
}

interface TaskDetailsModalProps {
  task: Task
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  onDelete: (taskId: string) => void
}

type TaskUpdatePayload = Partial<Task> & {
  taskType?: 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'PROPOSAL' | 'ADMIN' | 'OTHER' | null
}

export default function TaskDetailsModal({
  task,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailsModalProps) {
  type TaskTypeOption = '' | 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'PROPOSAL' | 'ADMIN' | 'OTHER'
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes || '')
  const [dueDate, setDueDate] = useState(
    task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : ''
  )
  const [priority, setPriority] = useState(task.priority)
  const [responsible, setResponsible] = useState(task.responsible || '')
  const [reminderDate, setReminderDate] = useState(
    task.reminder_at ? new Date(task.reminder_at).toISOString().split('T')[0] : ''
  )
  const [taskType, setTaskType] = useState<TaskTypeOption>((task.task_type as TaskTypeOption) || '')
  const [contactId, setContactId] = useState(task.contactId || '')
  const [companyId, setCompanyId] = useState(task.companyId || '')
  const [dealId, setDealId] = useState(task.dealId || '')
  const [contacts, setContacts] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [files, setFiles] = useState<TaskFile[]>(task.files || [])
  const [isUploading, setIsUploading] = useState(false)
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false)
  const [subtasks, setSubtasks] = useState<SubTask[]>(task.subtasks || [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [tags, setTags] = useState<Tag[]>(task.tags || [])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [archived, setArchived] = useState((task as any).archived || false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes || '')
    setDueDate(
      task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : ''
    )
    setPriority(task.priority)
    setResponsible(task.responsible || '')
    setReminderDate(
      task.reminder_at ? new Date(task.reminder_at).toISOString().split('T')[0] : ''
    )
    setTaskType((task.task_type as TaskTypeOption) || '')
    setContactId(task.contactId || '')
    setCompanyId(task.companyId || '')
    setDealId(task.dealId || '')
    setFiles(task.files || [])
    setArchived((task as any).archived || false)
    // Fetch files, subtasks, tags and workspace members when modal opens
    if (task.id) {
      fetchFiles()
      fetchSubtasks()
      fetchTags()
      fetchAvailableTags()
      fetchWorkspaceMembers()
      checkWorkspaceOwnership()
      fetchCrmOptions()
      fetchTaskCrmDetails()
    }
  }, [task.id])

  const fetchCrmOptions = async () => {
    try {
      const [contactsRes, companiesRes, dealsRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/companies'),
        fetch('/api/deals'),
      ])

      if (contactsRes.ok) {
        const data = await contactsRes.json()
        setContacts(data.contacts || [])
      }
      if (companiesRes.ok) {
        const data = await companiesRes.json()
        setCompanies(data.companies || [])
      }
      if (dealsRes.ok) {
        const data = await dealsRes.json()
        setDeals(data.deals || [])
      }
    } catch {
      // Error fetching CRM options
    }
  }

  const fetchTaskCrmDetails = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`)
      if (!res.ok) return
      const data = await res.json()
      const currentTask = data.task
      setContactId(currentTask.contactId || '')
      setCompanyId(currentTask.companyId || '')
      setDealId(currentTask.dealId || '')
      setTaskType((currentTask.task_type as TaskTypeOption) || '')
      setReminderDate(
        currentTask.reminder_at ? new Date(currentTask.reminder_at).toISOString().split('T')[0] : ''
      )
    } catch {
      // Error fetching task CRM details
    }
  }

  const fetchWorkspaceMembers = async () => {
    try {
      // First, get the task details to find its workspace and owner
      const taskRes = await fetch(`/api/tasks/${task.id}`)
      if (!taskRes.ok) {
        // Fallback to current workspace members and owner
        const workspaceRes = await fetch('/api/workspace')
        const membersRes = await fetch('/api/workspace/members')
        if (workspaceRes.ok && membersRes.ok) {
          const workspaceData = await workspaceRes.json()
          const membersData = await membersRes.json()
          
          const allMembers = [...(membersData.members || [])]
          // Note: Current workspace API doesn't include owner in response, so we skip owner for fallback
          setWorkspaceMembers(allMembers)
        }
        return
      }
      
      const taskData = await taskRes.json()
      const taskWorkspace = taskData.task.workspace
      
      if (!taskWorkspace) {
        // Fallback to current workspace members
        const membersRes = await fetch('/api/workspace/members')
        if (membersRes.ok) {
          const membersData = await membersRes.json()
          setWorkspaceMembers(membersData.members || [])
        }
        return
      }
      
      // Get current user's workspace info
      const workspaceRes = await fetch('/api/workspace')
      if (workspaceRes.ok) {
        const workspaceData = await workspaceRes.json()
        const currentWorkspaceId = workspaceData.workspace.id
        
        // Check if task is in current workspace
        if (taskWorkspace.id === currentWorkspaceId) {
          // Task is in current workspace, fetch members and add owner
          const membersRes = await fetch('/api/workspace/members')
          if (membersRes.ok) {
            const membersData = await membersRes.json()
            const allMembers = [...(membersData.members || [])]
            
            // Add owner from task workspace if available
            if (taskWorkspace.owner) {
              allMembers.unshift({
                id: 'owner',
                userId: taskWorkspace.owner.id,
                role: 'OWNER',
                user: taskWorkspace.owner,
              })
            }
            
            setWorkspaceMembers(allMembers)
          }
        } else {
          // Task is in a different workspace
          // Use owner from task workspace
          const allMembers: WorkspaceMember[] = []
          
          if (taskWorkspace.owner) {
            allMembers.push({
              id: 'owner',
              userId: taskWorkspace.owner.id,
              role: 'OWNER',
              user: taskWorkspace.owner,
            })
          }
          
          setWorkspaceMembers(allMembers)
        }
      }
    } catch {
      // Error fetching workspace members
    }
  }

  const checkWorkspaceOwnership = async () => {
    try {
      // Get task details to find its workspace and check ownership
      const taskRes = await fetch(`/api/tasks/${task.id}`)
      if (!taskRes.ok) {
        // Fallback: check current workspace
        const res = await fetch('/api/workspace')
        if (res.ok) {
          const data = await res.json()
          setIsWorkspaceOwner(data.workspace.isOwner || false)
        }
        return
      }
      
      const taskData = await taskRes.json()
      const taskWorkspace = taskData.task.workspace
      
      if (!taskWorkspace) {
        // Fallback: check current workspace
        const res = await fetch('/api/workspace')
        if (res.ok) {
          const data = await res.json()
          setIsWorkspaceOwner(data.workspace.isOwner || false)
        }
        return
      }
      
      // Use the isOwner flag from the task's workspace
      setIsWorkspaceOwner(taskWorkspace.isOwner || false)
    } catch {
      // Error checking workspace ownership
    }
  }

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/files`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      } else {
        // If endpoint returns error, just use files from task prop
        const errorData = await res.json().catch(() => null)
        if (errorData?.error) {
          // Error fetching files
        }
        // Keep files from task prop as fallback
      }
    } catch {
      // Error fetching files
      // If error, just use files from task prop
      setFiles(task.files || [])
    }
  }

  const fetchSubtasks = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`)
      if (res.ok) {
        const data = await res.json()
        setSubtasks(data.subtasks || [])
      } else {
        // If endpoint returns error, just use subtasks from task prop
        setSubtasks(task.subtasks || [])
      }
    } catch {
      // Error fetching subtasks
      setSubtasks(task.subtasks || [])
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    setIsAddingSubtask(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSubtasks([...subtasks, data.subtask])
        setNewSubtaskTitle('')
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la adăugarea subsarcinii')
      }
    } catch {
      alert('Eroare la adăugarea subsarcinii')
    } finally {
      setIsAddingSubtask(false)
    }
  }

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: !completed,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSubtasks(subtasks.map((st) => (st.id === subtaskId ? data.subtask : st)))
      } else {
        alert('Eroare la actualizarea subsarcinii')
      }
    } catch {
      alert('Eroare la actualizarea subsarcinii')
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această subsarcină?')) return

    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSubtasks(subtasks.filter((st) => st.id !== subtaskId))
      } else {
        alert('Eroare la ștergerea subsarcinii')
      }
    } catch {
      alert('Eroare la ștergerea subsarcinii')
    }
  }

  const handleUpdateSubtaskTitle = async (subtaskId: string, newTitle: string) => {
    if (!newTitle.trim()) return

    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle.trim(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSubtasks(subtasks.map((st) => (st.id === subtaskId ? data.subtask : st)))
      } else {
        alert('Eroare la actualizarea subsarcinii')
      }
    } catch {
      alert('Eroare la actualizarea subsarcinii')
    }
  }

  // Calculate progress based on completed subtasks
  const subtaskProgress = subtasks.length > 0
    ? Math.round((subtasks.filter((st) => st.completed).length / subtasks.length) * 100)
    : 0

  const fetchTags = async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/tags`)
      if (res.ok) {
        const data = await res.json()
        setTags(data.tags || [])
      } else {
        setTags(task.tags || [])
      }
    } catch {
      setTags(task.tags || [])
    }
  }

  const fetchAvailableTags = async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setAvailableTags(data.tags || [])
      }
    } catch {
      // Error fetching available tags
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setIsCreatingTag(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAvailableTags([...availableTags, data.tag])
        // Automatically add the new tag to the task
        await handleAddTagToTask(data.tag.id)
        setNewTagName('')
        setShowTagInput(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la crearea etichetei')
      }
    } catch {
      alert('Eroare la crearea etichetei')
    } finally {
      setIsCreatingTag(false)
    }
  }

  const handleAddTagToTask = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagId }),
      })

      if (res.ok) {
        const data = await res.json()
        setTags([...tags, data.tag])
        // Refresh available tags to update the list
        await fetchAvailableTags()
      } else {
        const error = await res.json()
        if (error.error !== 'Tag already assigned to task') {
          alert(error.error || 'Eroare la adăugarea etichetei')
        }
      }
    } catch {
      alert('Eroare la adăugarea etichetei')
    }
  }

  const handleRemoveTagFromTask = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/tags/${tagId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTags(tags.filter((t) => t.id !== tagId))
      } else {
        alert('Eroare la eliminarea etichetei')
      }
    } catch {
      alert('Eroare la eliminarea etichetei')
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această etichetă? Va fi eliminată de la toate sarcinile.')) return

    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setAvailableTags(availableTags.filter((t) => t.id !== tagId))
        setTags(tags.filter((t) => t.id !== tagId))
      } else {
        alert('Eroare la ștergerea etichetei')
      }
    } catch {
      alert('Eroare la ștergerea etichetei')
    }
  }

  // Get tags that are not already assigned to the task
  const unassignedTags = availableTags.filter(
    (tag) => !tags.some((taskTag) => taskTag.id === tag.id)
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/tasks/${task.id}/files`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        await fetchFiles()
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la încărcarea fișierului')
      }
    } catch {
      // Error uploading file
      alert('Eroare la încărcarea fișierului')
    } finally {
      setIsUploading(false)
      e.target.value = '' // Reset input
    }
  }

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest fișier?')) return

    try {
      const res = await fetch(`/api/tasks/${task.id}/files/${fileId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setFiles(files.filter((f) => f.id !== fileId))
      } else {
        alert('Eroare la ștergerea fișierului')
      }
    } catch {
      // Error deleting file
      alert('Eroare la ștergerea fișierului')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updates: TaskUpdatePayload = {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        reminder_at: reminderDate ? new Date(reminderDate).toISOString() : null,
        responsible: responsible || null,
        taskType: taskType || null,
        contactId: contactId || null,
        companyId: companyId || null,
        dealId: dealId || null,
      }
      await onUpdate(task.id, updates)
      onClose()
    } catch {
      // Error saving task
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (confirm('Ești sigur că vrei să ștergi această sarcină?')) {
      onDelete(task.id)
      onClose()
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived }),
      })

      if (res.ok) {
        const data = await res.json()
        setArchived(data.task.archived)
        await onUpdate(task.id, { archived: data.task.archived })
        if (data.task.archived) {
          onClose() // Close modal if task is archived
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la arhivarea sarcinii')
      }
    } catch {
      alert('Eroare la arhivarea sarcinii')
    } finally {
      setIsArchiving(false)
    }
  }

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeSubtasks: true,
          includeFiles: true,
        }),
      })

      if (res.ok) {
        await res.json()
        onClose()
        window.location.reload()
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la duplicarea sarcinii')
      }
    } catch {
      alert('Eroare la duplicarea sarcinii')
    } finally {
      setIsDuplicating(false)
    }
  }

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl md:max-h-[85vh]">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalii Sarcină
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Titlu
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Titlu sarcină"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Termen Limită
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Reminder
                </label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  Prioritate
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Fără</option>
                  <option value={1}>Scăzută</option>
                  <option value={2}>Medie</option>
                  <option value={3}>Ridicată</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Responsabil
                </label>
                <select
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Fără responsabil</option>
                  {workspaceMembers.map((member) => (
                    <option key={member.userId} value={member.user.name}>
                      {member.user.name} {member.role === 'OWNER' ? '(Owner)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as TaskTypeOption)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Fără tip</option>
                  <option value="CALL">Call</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">Meeting</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact asociat
                </label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Fără contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Companie asociată
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Fără companie</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Handshake className="w-4 h-4" />
                  Opportunity asociat
                </label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Fără opportunity</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Note
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adaugă note..."
                />
              </div>

              {/* Subtasks Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Subsarcini
                  {subtasks.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      {subtasks.filter((st) => st.completed).length} / {subtasks.length}
                    </span>
                  )}
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                  {/* Progress Bar */}
                  {subtasks.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Progres</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {subtaskProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${subtaskProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Add Subtask Input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSubtask()
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Adaugă o subsarcină..."
                      disabled={isAddingSubtask}
                    />
                    <button
                      onClick={handleAddSubtask}
                      disabled={isAddingSubtask || !newSubtaskTitle.trim()}
                      className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtasks List */}
                  {subtasks.length > 0 && (
                    <div className="space-y-2">
                      {subtasks.map((subtask) => (
                        <SubtaskItem
                          key={subtask.id}
                          subtask={subtask}
                          onToggle={() => handleToggleSubtask(subtask.id, subtask.completed)}
                          onDelete={() => handleDeleteSubtask(subtask.id)}
                          onUpdateTitle={(newTitle) => handleUpdateSubtaskTitle(subtask.id, newTitle)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Etichete
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                  {/* Current Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTagFromTask(tag.id)}
                            className="hover:bg-black/20 rounded p-0.5 transition-colors"
                            title="Elimină etichetă"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add Tag Dropdown */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddTagToTask(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selectează o etichetă...</option>
                        {unassignedTags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowTagInput(!showTagInput)}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Create New Tag Input */}
                    {showTagInput && (
                      <div className="flex gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Nume etichetă"
                          className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCreateTag()
                            }
                          }}
                        />
                        <input
                          type="color"
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          title="Selectează culoarea"
                        />
                        <button
                          onClick={handleCreateTag}
                          disabled={isCreatingTag || !newTagName.trim()}
                          className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCreatingTag ? '...' : 'Creează'}
                        </button>
                        <button
                          onClick={() => {
                            setShowTagInput(false)
                            setNewTagName('')
                            setNewTagColor('#3b82f6')
                          }}
                          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Available Tags List (for management) */}
                    {availableTags.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Etichete disponibile:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                border: `1px solid ${tag.color}40`,
                              }}
                            >
                              {tag.name}
                              <button
                                onClick={() => handleDeleteTag(tag.id)}
                                className="hover:bg-black/10 rounded p-0.5 transition-colors"
                                title="Șterge etichetă"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Fișiere și Imagini
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg cursor-pointer transition-colors ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {isUploading ? 'Se încarcă...' : 'Încarcă fișier'}
                    </span>
                  </label>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {isImage(file.mimeType) ? (
                            <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                              {/* Thumbnails use dynamic API paths; next/image needs host config */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={file.filePath}
                                alt={file.fileName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-16 h-16 rounded bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                              <File className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={file.filePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                            >
                              {file.fileName}
                            </a>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.fileSize)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleFileDelete(file.id)}
                            className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Șterge fișier"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <CommentsSection
                  taskId={task.id}
                  workspaceMembers={workspaceMembers}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Mai multe acțiuni"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {showActionsMenu && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowActionsMenu(false)}
                      />
                      {/* Menu */}
                      <div className="absolute left-0 bottom-full mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                        <button
                          onClick={() => {
                            handleDuplicate()
                            setShowActionsMenu(false)
                          }}
                          disabled={isDuplicating}
                          className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Duplică
                        </button>
                        <button
                          onClick={() => {
                            handleArchive()
                            setShowActionsMenu(false)
                          }}
                          disabled={isArchiving}
                          className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {archived ? (
                            <>
                              <ArchiveRestore className="w-4 h-4" />
                              Restaurează
                            </>
                          ) : (
                            <>
                              <Archive className="w-4 h-4" />
                              Arhivează
                            </>
                          )}
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700" />
                        <button
                          onClick={() => {
                            handleDelete()
                            setShowActionsMenu(false)
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Șterge
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !title.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

// SubtaskItem Component
interface SubtaskItemProps {
  subtask: SubTask
  onToggle: () => void
  onDelete: () => void
  onUpdateTitle: (newTitle: string) => void
}

function SubtaskItem({ subtask, onToggle, onDelete, onUpdateTitle }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(subtask.title)

  useEffect(() => {
    setEditTitle(subtask.title)
  }, [subtask.title])

  const handleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== subtask.title) {
      onUpdateTitle(editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(subtask.title)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group">
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          subtask.completed
            ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
        }`}
      >
        {subtask.completed && <Check className="w-3 h-3 text-white" />}
      </button>
      {isEditing ? (
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
            className="flex-1 px-2 py-1 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Salvează
          </button>
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Anulează
          </button>
        </div>
      ) : (
        <>
          <span
            onClick={() => setIsEditing(true)}
            className={`flex-1 text-sm cursor-pointer ${
              subtask.completed
                ? 'line-through text-gray-500 dark:text-gray-400'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {subtask.title}
          </span>
          <button
            onClick={onDelete}
            className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Șterge subsarcină"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}

