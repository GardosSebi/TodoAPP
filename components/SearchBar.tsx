'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Folder } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Task, Project } from '@/types'

interface SearchResult {
  tasks: Task[]
  projects: Project[]
}

interface SearchBarProps {
  onResultClick?: (type: 'task' | 'project', id: string) => void
}

export default function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ tasks: [], projects: [] })
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // Keyboard shortcut: Ctrl/Cmd + K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const input = document.getElementById('search-input') as HTMLInputElement
        if (input) {
          input.focus()
          setIsOpen(true)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults({ tasks: [], projects: [] })
      setIsOpen(false)
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=all`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setIsOpen(true)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleTaskClick = (taskId: string, projectId?: string) => {
    setIsOpen(false)
    setQuery('')
    if (onResultClick) {
      onResultClick('task', taskId)
    } else if (projectId) {
      router.push(`/app/project/${projectId}?task=${taskId}`)
    } else {
      router.push(`/app?task=${taskId}`)
    }
  }

  const handleProjectClick = (projectId: string) => {
    setIsOpen(false)
    setQuery('')
    if (onResultClick) {
      onResultClick('project', projectId)
    } else {
      router.push(`/app/project/${projectId}`)
    }
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Caută sarcini și proiecte... (Ctrl+K)"
          className="w-full pl-10 pr-10 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setIsOpen(false)
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (query.trim() || results.tasks.length > 0 || results.projects.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto custom-scrollbar">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Căutare...
            </div>
          ) : results.tasks.length === 0 && results.projects.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Nu s-au găsit rezultate
            </div>
          ) : (
            <>
              {results.tasks.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Sarcini ({results.tasks.length})
                  </div>
                  {results.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id, task.projectId || undefined)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-start gap-3"
                    >
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {task.title}
                        </div>
                        {task.project && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {task.project.name}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.projects.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Proiecte ({results.projects.length})
                  </div>
                  {results.projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {project.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(project as any).taskCount || 0} sarcini
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

