'use client'

import { useState } from 'react'
import { Plus, Calendar } from 'lucide-react'

interface QuickAddTaskProps {
  onAdd: (title: string, description?: string, deadline?: string, priority?: number) => void
  placeholder?: string
  projectId?: string
}

export default function QuickAddTask({
  onAdd,
  placeholder = 'Adaugă o sarcină...',
  projectId,
}: QuickAddTaskProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<number | ''>('')
  const [isFocused, setIsFocused] = useState(false)
  const [showDescription, setShowDescription] = useState(false)

  // Show priority field when user starts typing or focuses
  const shouldShowFields = showDescription || title.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && priority !== '') {
      onAdd(title.trim(), description.trim() || undefined, deadline || undefined, priority as number)
      setTitle('')
      setDescription('')
      setDeadline('')
      setPriority('')
      setShowDescription(false)
      setIsFocused(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`border rounded-lg transition-colors ${
        isFocused
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        <Plus className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (e.target.value.trim().length > 0) {
              setShowDescription(true)
            }
          }}
          onFocus={() => {
            setIsFocused(true)
            setShowDescription(true)
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={!title.trim() || priority === ''}
          className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Adaugă
        </button>
      </div>
      {shouldShowFields && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value === '' ? '' : Number(e.target.value))}
              onFocus={() => setIsFocused(true)}
              required
              className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selectează prioritatea (obligatoriu)</option>
              <option value="0">Fără (0)</option>
              <option value="1">Scăzută (1)</option>
              <option value="2">Medie (2)</option>
              <option value="3">Ridicată (3)</option>
            </select>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!description.trim() && !title.trim() && !deadline && priority === '') {
                setIsFocused(false)
                if (title.trim().length === 0) {
                  setShowDescription(false)
                }
              }
            }}
            placeholder="Adaugă o descriere (opțional)..."
            rows={2}
            className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
          />
          <div className="flex items-center gap-2">         
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Termen limită (opțional)"
              className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </form>
  )
}

