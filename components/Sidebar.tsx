'use client'

import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  InboxIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  FolderIcon,
  PlusIcon,
  LogOutIcon,
  ShieldIcon,
  SunIcon,
  MoonIcon,
  X,
  Menu,
} from 'lucide-react'
import { motion } from 'framer-motion'
import TeamManagement from './TeamManagement'
import WorkspaceMembers from './WorkspaceMembers'

interface Project {
  id: string
  name: string
  color: string | null
  _count: {
    tasks: number
  }
  user?: {
    id: string
    email: string
  }
  workspace?: {
    id: string
    name: string
    userId: string
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [workspaceName, setWorkspaceName] = useState('Todo App')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchWorkspace()
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const initialTheme = savedTheme || 'dark'
    setTheme(initialTheme)
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const fetchWorkspace = async () => {
    try {
      const res = await fetch('/api/workspace')
      if (res.ok) {
        const data = await res.json()
        if (data.workspace?.name) {
          setWorkspaceName(data.workspace.name)
        }
      }
    } catch (error) {
      // Error fetching workspace
    }
  }

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (data.projects) {
        setProjects(data.projects)
      }
    } catch (error) {
      // Error fetching projects
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })

      if (res.ok) {
        setNewProjectName('')
        setShowNewProject(false)
        fetchProjects()
      }
    } catch (error) {
      // Error creating project
    }
  }

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Ești sigur că vrei să ștergi acest proiect? Toate sarcinile vor fi eliminate.')) {
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // If user is currently viewing the deleted project, redirect to inbox
        if (pathname === `/app/project/${projectId}`) {
          router.push('/app')
        }
        fetchProjects()
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Eroare la ștergerea proiectului')
      }
    } catch (error) {
      alert('Eroare la ștergerea proiectului')
    }
  }
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const navItems = [
    { href: '/app', label: 'Primite', icon: InboxIcon },
    { href: '/app/today', label: 'Calendar', icon: CalendarIcon },
    { href: '/app/upcoming', label: 'Viitoare', icon: ClockIcon },
    { href: '/app/completed', label: 'Finalizate', icon: CheckCircleIcon },
  ]

  const isActive = (href: string) => {
    if (href === '/app') {
      return pathname === '/app'
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile menu button - only show when sidebar is closed */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate" title={workspaceName}>
            {workspaceName}
          </h1>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {session?.user?.role === 'ADMIN' && (
          <Link
            href="/app/admin"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/app/admin'
                ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <ShieldIcon className="w-5 h-5" />
            <span>Admin</span>
          </Link>
        )}

        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Proiecte
            </h2>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {showNewProject && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCreateProject}
              className="mb-2"
            >
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Nume proiect"
                className="w-full px-3 py-2 text-sm text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
                autoFocus
                onBlur={() => {
                  if (!newProjectName.trim()) {
                    setShowNewProject(false)
                  }
                }}
              />
            </motion.form>
          )}

          <div className="space-y-1">
            {projects.map((project) => {
              const active = pathname === `/app/project/${project.id}`
              const isShared = project.user && project.user.id !== session?.user?.id
              const isFromOtherWorkspace = project.workspace && project.workspace.userId !== session?.user?.id
              const isOwner = project.user && project.user.id === session?.user?.id
              return (
                <div
                  key={project.id}
                  className={`group relative flex flex-col gap-1 px-3 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/app/project/${project.id}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <FolderIcon
                        className="w-5 h-5 flex-shrink-0"
                        style={{
                          color: project.color || '#9ca3af',
                        }}
                      />
                      <span className="flex-1 truncate font-medium">{project.name}</span>
                      {isShared && (
                        <span className="text-xs text-blue-600 dark:text-blue-400" title="Proiect partajat">
                          •
                        </span>
                      )}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {project._count.tasks}
                    </span>
                    {isOwner && (
                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                        title="Șterge proiect"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {project.workspace && isFromOtherWorkspace && (
                    <div className="flex items-center gap-2 pl-8">
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={project.workspace.name}>
                        {project.workspace.name}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </nav>

      {session?.user?.role === 'ADMIN' && <TeamManagement />}

      <WorkspaceMembers />

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {session?.user?.email && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate">
            {session.user.email}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
          >
            {theme === 'light' ? (
              <MoonIcon className="w-5 h-5" />
            ) : (
              <SunIcon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex-1 flex items-center justify-center gap-3 px-3 py-2 text-gray-700 hover:bg-red-50 hover:text-red-700 dark:text-gray-300 dark:hover:bg-red-900/50 dark:hover:text-red-400 rounded-lg transition-colors font-medium"
          >
            <LogOutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}

