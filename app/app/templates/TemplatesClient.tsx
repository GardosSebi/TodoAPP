'use client'

import { useState, useOptimistic } from 'react'
import { Plus, Edit2, Trash2, Copy, X, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Template {
  id: string
  name: string
  description: string | null
  title: string
  notes: string | null
  priority: number
  responsible: string | null
  subtasks: string[]
  tagIds: string[]
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
  color: string | null
}

interface Tag {
  id: string
  name: string
  color: string
}

interface WorkspaceUser {
  id: string
  name: string
  email: string
}

interface TemplatesClientProps {
  initialTemplates: Template[]
  projects: Project[]
  tags: Tag[]
  workspaceUsers: WorkspaceUser[]
}

export default function TemplatesClient({
  initialTemplates,
  projects,
  tags,
  workspaceUsers,
}: TemplatesClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [createTaskTemplateId, setCreateTaskTemplateId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    title: '',
    notes: '',
    priority: 0,
    responsible: '',
    subtasks: [] as string[],
    tagIds: [] as string[],
  })

  const [newSubtask, setNewSubtask] = useState('')

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      title: '',
      notes: '',
      priority: 0,
      responsible: '',
      subtasks: [],
      tagIds: [],
    })
    setNewSubtask('')
    setEditingTemplate(null)
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.title.trim()) {
      alert('Numele și titlul template-ului sunt obligatorii')
      return
    }

    try {
      const res = await fetch('/api/task-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        setTemplates([data.template, ...templates])
        resetForm()
        setShowCreateModal(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la crearea template-ului')
      }
    } catch (error) {
      alert('Eroare la crearea template-ului')
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.title.trim()) {
      alert('Numele și titlul template-ului sunt obligatorii')
      return
    }

    try {
      const res = await fetch(`/api/task-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        setTemplates(templates.map((t) => (t.id === editingTemplate.id ? data.template : t)))
        resetForm()
        setEditingTemplate(null)
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la actualizarea template-ului')
      }
    } catch (error) {
      alert('Eroare la actualizarea template-ului')
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest template?')) {
      return
    }

    try {
      const res = await fetch(`/api/task-templates/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== id))
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la ștergerea template-ului')
      }
    } catch (error) {
      alert('Eroare la ștergerea template-ului')
    }
  }

  const handleCreateTaskFromTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/task-templates/${templateId}/create-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setCreateTaskTemplateId(null)
        setSelectedProjectId('')
        
        // Dispatch event to notify sidebar to update task counts
        window.dispatchEvent(new CustomEvent('taskCreated', { 
          detail: { projectId: data.task?.projectId || null } 
        }))
        
        // If task was created with a project, redirect to project page
        if (data.task?.projectId) {
          window.location.href = `/app/project/${data.task.projectId}`
        } else {
          // Otherwise redirect to inbox
          window.location.href = '/app'
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la crearea task-ului')
      }
    } catch (error) {
      alert('Eroare la crearea task-ului')
    }
  }

  const startEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      title: template.title,
      notes: template.notes || '',
      priority: template.priority,
      responsible: template.responsible || '',
      subtasks: [...template.subtasks],
      tagIds: [...template.tagIds],
    })
    setShowCreateModal(true)
  }

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setFormData({
        ...formData,
        subtasks: [...formData.subtasks, newSubtask.trim()],
      })
      setNewSubtask('')
    }
  }

  const removeSubtask = (index: number) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks.filter((_, i) => i !== index),
    })
  }


  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 3:
        return 'Ridicată'
      case 2:
        return 'Medie'
      case 1:
        return 'Scăzută'
      default:
        return 'Fără prioritate'
    }
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
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Template-uri</h1>
        <button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Template nou</span>
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Nu ai template-uri create</p>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Creează primul template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {template.name}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(template)}
                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Editează"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Șterge"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {template.description}
                </p>
              )}

              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {template.title}
                </p>
                {template.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                    {template.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 mb-3 text-xs">
                <span className={getPriorityColor(template.priority)}>
                  {getPriorityLabel(template.priority)}
                </span>
                {template.responsible && (
                  <span className="text-gray-500 dark:text-gray-400">
                    Responsabil: {template.responsible}
                  </span>
                )}
              </div>

              {template.subtasks.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Subtask-uri ({template.subtasks.length}):
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {template.subtasks.slice(0, 3).map((subtask, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {subtask}
                      </li>
                    ))}
                    {template.subtasks.length > 3 && (
                      <li className="text-gray-400">+{template.subtasks.length - 3} mai multe</li>
                    )}
                  </ul>
                </div>
              )}


              <button
                onClick={() => {
                  setCreateTaskTemplateId(template.id)
                  setSelectedProjectId('')
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Copy className="w-4 h-4" />
                <span>Creează task</span>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowCreateModal(false)
              resetForm()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {editingTemplate ? 'Editează template' : 'Template nou'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nume template *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="ex: Template pentru meeting"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descriere
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="Descriere opțională"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Titlu task *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="Titlul task-ului"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Note
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      rows={3}
                      placeholder="Note opționale"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Prioritate
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value={0}>Fără prioritate</option>
                        <option value={1}>Scăzută</option>
                        <option value={2}>Medie</option>
                        <option value={3}>Ridicată</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Responsabil
                      </label>
                      <select
                        value={formData.responsible}
                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">Fără responsabil</option>
                        {workspaceUsers.map((user) => (
                          <option key={user.id} value={user.name || user.email}>
                            {user.name || user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subtask-uri
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addSubtask()
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Adaugă subtask"
                      />
                      <button
                        onClick={addSubtask}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Adaugă
                      </button>
                    </div>
                    <div className="space-y-1">
                      {formData.subtasks.map((subtask, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <span className="text-sm text-gray-900 dark:text-gray-100">{subtask}</span>
                          <button
                            onClick={() => removeSubtask(index)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Anulează
                  </button>
                  <button
                    onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingTemplate ? 'Salvează' : 'Creează'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {createTaskTemplateId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setCreateTaskTemplateId(null)
              setSelectedProjectId('')
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Creează task din template
              </h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proiect 
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Fără proiect</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCreateTaskTemplateId(null)
                    setSelectedProjectId('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Anulează
                </button>
                <button
                  onClick={() => handleCreateTaskFromTemplate(createTaskTemplateId)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Creează task
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

