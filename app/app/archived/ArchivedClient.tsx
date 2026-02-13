'use client'

import { useState } from 'react'
import { Archive, ArchiveRestore, Trash2, Folder, FileText } from 'lucide-react'
import { Task, Project } from '@/types'
import { formatDate } from '@/lib/utils'
import TaskDetailsModal from '@/components/TaskDetailsModal'

interface ArchivedClientProps {
  initialTasks: Task[]
  initialProjects: Project[]
}

type ViewType = 'tasks' | 'projects' | 'all'

export default function ArchivedClient({ initialTasks, initialProjects }: ArchivedClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [view, setView] = useState<ViewType>('all')

  const handleRestoreTask = async (taskId: string) => {
    setIsRestoring(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })

      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId))
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la restaurarea sarcinii')
      }
    } catch (error) {
      alert('Eroare la restaurarea sarcinii')
    } finally {
      setIsRestoring(null)
    }
  }

  const handleRestoreProject = async (projectId: string) => {
    setIsRestoring(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })

      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
        // Dispatch event to notify sidebar to update project list
        window.dispatchEvent(new CustomEvent('projectRestored', { 
          detail: { projectId } 
        }))
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la restaurarea proiectului')
      }
    } catch (error) {
      alert('Eroare la restaurarea proiectului')
    } finally {
      setIsRestoring(null)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi definitiv această sarcină?')) return

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId))
        if (selectedTask?.id === taskId) {
          setSelectedTask(null)
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la ștergerea sarcinii')
      }
    } catch (error) {
      alert('Eroare la ștergerea sarcinii')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi definitiv acest proiect? Toate sarcinile vor fi șterse.')) return

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
        // Also remove tasks from this project
        setTasks(tasks.filter(t => t.projectId !== projectId))
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la ștergerea proiectului')
      }
    } catch (error) {
      alert('Eroare la ștergerea proiectului')
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    )
    setTasks(updatedTasks)
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates } as Task)
    }
  }

  const showProjects = view === 'projects' || view === 'all'
  const showTasks = view === 'tasks' || view === 'all'

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Arhivate
        </h1>
        
        {/* View Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'all'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            Toate ({tasks.length + projects.length})
          </button>
          <button
            onClick={() => setView('tasks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'tasks'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Sarcini ({tasks.length})
          </button>
          <button
            onClick={() => setView('projects')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'projects'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Folder className="w-4 h-4" />
            Proiecte ({projects.length})
          </button>
        </div>
      </div>

      {/* Archived Projects */}
      {showProjects && projects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Proiecte Arhivate ({projects.length})
          </h2>
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {project.color && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {project.name}
                  </span>
                  {(project as any)._count?.tasks > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({(project as any)._count.tasks} sarcini)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestoreProject(project.id)}
                    disabled={isRestoring === project.id}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 flex items-center gap-2"
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Tasks */}
      {showTasks && tasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Sarcini Arhivate ({tasks.length})
          </h2>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {task.title}
                    </h3>
                    {task.project && (
                      <div className="flex items-center gap-2 mb-2">
                        {task.project.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: task.project.color }}
                          />
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {task.project.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {task.due_at && (
                        <span>Termen: {formatDate(task.due_at)}</span>
                      )}
                      <span>Arhivat: {formatDate(task.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRestoreTask(task.id)}
                      disabled={isRestoring === task.id}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
                      title="Restaurează"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      title="Șterge definitiv"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && projects.length === 0 && (
        <div className="text-center py-12">
          <Archive className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Nu există sarcini sau proiecte arhivate
          </p>
        </div>
      )}

      {((view === 'tasks' && tasks.length === 0) || (view === 'projects' && projects.length === 0)) && (
        <div className="text-center py-12">
          <Archive className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {view === 'tasks' 
              ? 'Nu există sarcini arhivate'
              : 'Nu există proiecte arhivate'}
          </p>
        </div>
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  )
}


