'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Folder, Users, Building2, Handshake } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Task, Project } from '@/types'

interface SearchResult {
  tasks: Task[]
  projects: Project[]
  contacts?: any[]
  companies?: any[]
  deals?: any[]
}

interface SearchBarProps {
  onResultClick?: (type: 'task' | 'project', id: string) => void
}

function scoreRelevance(text: string, query: string): number {
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase().trim()
  if (!needle) return 0
  if (haystack === needle) return 120
  if (haystack.startsWith(needle)) return 90
  const idx = haystack.indexOf(needle)
  if (idx >= 0) return 70 - Math.min(idx, 40)
  return 0
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'ig')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={`${part}-${i}`} className="bg-yellow-200/70 text-inherit dark:bg-yellow-400/40 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${i}`}>{part}</span>
    )
  )
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
        // Search error
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

  const trimmedQuery = query.trim()
  const sortedTasks = [...results.tasks].sort((a, b) => {
    const aScore = Math.max(scoreRelevance(a.title || '', trimmedQuery), scoreRelevance(a.project?.name || '', trimmedQuery))
    const bScore = Math.max(scoreRelevance(b.title || '', trimmedQuery), scoreRelevance(b.project?.name || '', trimmedQuery))
    return bScore - aScore
  })
  const sortedProjects = [...results.projects].sort(
    (a, b) => scoreRelevance((b as any).name || '', trimmedQuery) - scoreRelevance((a as any).name || '', trimmedQuery)
  )
  const sortedContacts = [...(results.contacts || [])].sort((a: any, b: any) => {
    const aText = `${a.first_name || ''} ${a.last_name || ''} ${a.email || ''}`.trim()
    const bText = `${b.first_name || ''} ${b.last_name || ''} ${b.email || ''}`.trim()
    return scoreRelevance(bText, trimmedQuery) - scoreRelevance(aText, trimmedQuery)
  })
  const sortedCompanies = [...(results.companies || [])].sort(
    (a: any, b: any) => scoreRelevance(b.name || '', trimmedQuery) - scoreRelevance(a.name || '', trimmedQuery)
  )
  const sortedDeals = [...(results.deals || [])].sort(
    (a: any, b: any) => scoreRelevance(b.title || '', trimmedQuery) - scoreRelevance(a.title || '', trimmedQuery)
  )

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
          placeholder="Caută sarcini, proiecte, contacte, companii... (Ctrl+K)"
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

      {isOpen && (query.trim() || sortedTasks.length > 0 || sortedProjects.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto custom-scrollbar">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Căutare...
            </div>
          ) : sortedTasks.length === 0 &&
            sortedProjects.length === 0 &&
            sortedContacts.length === 0 &&
            sortedCompanies.length === 0 &&
            sortedDeals.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Nu s-au găsit rezultate pentru "{query.trim()}"
            </div>
          ) : (
            <>
              {sortedTasks.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Sarcini ({sortedTasks.length})
                  </div>
                  {sortedTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id, task.projectId || undefined)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-start gap-3"
                    >
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {highlightMatch(task.title, trimmedQuery)}
                        </div>
                        {task.project && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {highlightMatch(task.project.name, trimmedQuery)}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {sortedProjects.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Proiecte ({sortedProjects.length})
                  </div>
                  {sortedProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      <Folder 
                        className="w-4 h-4 flex-shrink-0"
                        style={{
                          color: (project as any).completed ? '#10b981' : '#9ca3af',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          (project as any).completed 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {highlightMatch(project.name, trimmedQuery)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(project as any).taskCount || 0} sarcini
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {sortedContacts.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Contacte ({sortedContacts.length})
                  </div>
                  {sortedContacts.map((contact: any) => (
                    <button
                      key={contact.id}
                      onClick={() => router.push(`/app/crm/contacts/${contact.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="truncate text-gray-900 dark:text-white">
                        {highlightMatch(`${contact.first_name} ${contact.last_name}`, trimmedQuery)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {sortedCompanies.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Companii ({sortedCompanies.length})
                  </div>
                  {sortedCompanies.map((company: any) => (
                    <button
                      key={company.id}
                      onClick={() => router.push(`/app/crm/companies/${company.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="truncate text-gray-900 dark:text-white">{highlightMatch(company.name, trimmedQuery)}</span>
                    </button>
                  ))}
                </div>
              )}

              {sortedDeals.length > 0 && (
                <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Oportunități ({sortedDeals.length})
                  </div>
                  {sortedDeals.map((deal: any) => (
                    <button
                      key={deal.id}
                      onClick={() => router.push(`/app/crm/deals/${deal.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      <Handshake className="w-4 h-4 text-gray-400" />
                      <span className="truncate text-gray-900 dark:text-white">{highlightMatch(deal.title, trimmedQuery)}</span>
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

