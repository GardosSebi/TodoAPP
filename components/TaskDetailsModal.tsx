'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { X, Calendar, Flag, FileText, Upload, Image as ImageIcon, File, Trash2, User } from 'lucide-react'
import { Task, TaskFile } from '@/types'
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
  onUpdate: (taskId: string, updates: Partial<Task>) => void
  onDelete: (taskId: string) => void
}

export default function TaskDetailsModal({
  task,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailsModalProps) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes || '')
  const [dueDate, setDueDate] = useState(
    task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : ''
  )
  const [priority, setPriority] = useState(task.priority)
  const [responsible, setResponsible] = useState(task.responsible || '')
  const [isSaving, setIsSaving] = useState(false)
  const [files, setFiles] = useState<TaskFile[]>(task.files || [])
  const [isUploading, setIsUploading] = useState(false)
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false)

  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes || '')
    setDueDate(
      task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : ''
    )
    setPriority(task.priority)
    setResponsible(task.responsible || '')
    setFiles(task.files || [])
    // Fetch files and workspace members when modal opens
    if (task.id) {
      fetchFiles()
      fetchWorkspaceMembers()
      checkWorkspaceOwnership()
    }
  }, [task.id])

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      // Error fetching files
      // If error, just use files from task prop
      setFiles(task.files || [])
    }
  }

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
    } catch (error) {
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
    } catch (error) {
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
      const updates: Partial<Task> = {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        responsible: responsible || null,
      }
      onUpdate(task.id, updates)
      onClose()
    } catch (error) {
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
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Șterge
              </button>
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

