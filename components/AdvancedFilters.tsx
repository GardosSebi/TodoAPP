'use client'

import { useState, useEffect } from 'react'
import { Filter, X, Save, Trash2, Calendar, Flag, User } from 'lucide-react'
import { Task } from '@/types'

interface FilterOptions {
  search?: string
  status?: string
  priority?: number
  responsible?: string
  projectId?: string
  dateFrom?: string
  dateTo?: string
}

interface FilterPreset {
  id: string
  name: string
  filters: FilterOptions
  created_at: string
}

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterOptions) => void
  projects?: Array<{ id: string; name: string; color?: string | null }>
  workspaceMembers?: Array<{ user: { name: string } }>
}

export default function AdvancedFilters({
  onFiltersChange,
  projects = [],
  workspaceMembers = [],
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({})
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)

  useEffect(() => {
    fetchPresets()
  }, [])

  useEffect(() => {
    onFiltersChange(filters)
  }, [filters])

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/filter-presets')
      if (res.ok) {
        const data = await res.json()
        setPresets(data.presets || [])
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
    }
  }

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  const savePreset = async () => {
    if (!presetName.trim()) return

    try {
      const res = await fetch('/api/filter-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName.trim(),
          filters: JSON.stringify(filters),
        }),
      })

      if (res.ok) {
        await fetchPresets()
        setPresetName('')
        setShowSavePreset(false)
      }
    } catch (error) {
      console.error('Error saving preset:', error)
    }
  }

  const loadPreset = (preset: FilterPreset) => {
    setFilters(preset.filters)
  }

  const deletePreset = async (presetId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi acest preset?')) return

    try {
      const res = await fetch(`/api/filter-presets/${presetId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchPresets()
      }
    } catch (error) {
      console.error('Error deleting preset:', error)
    }
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          hasActiveFilters
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filtre</span>
        {hasActiveFilters && (
          <span className="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 rounded text-xs">
            {Object.keys(filters).length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filtre</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Căutare
              </label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Caută în titlu sau note..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Prioritate
              </label>
              <select
                value={filters.priority || ''}
                onChange={(e) => handleFilterChange('priority', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toate</option>
                <option value="3">Ridicată</option>
                <option value="2">Medie</option>
                <option value="1">Scăzută</option>
                <option value="0">Fără</option>
              </select>
            </div>

            {/* Responsible */}
            {workspaceMembers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Responsabil
                </label>
                <select
                  value={filters.responsible || ''}
                  onChange={(e) => handleFilterChange('responsible', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toți</option>
                  {workspaceMembers.map((member) => (
                    <option key={member.user.name} value={member.user.name}>
                      {member.user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Project */}
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proiect
                </label>
                <select
                  value={filters.projectId || ''}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toate</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Interval de date
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="De la"
                />
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Până la"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Șterge filtre
              </button>
              <button
                onClick={() => setShowSavePreset(true)}
                disabled={!hasActiveFilters}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Salvează
              </button>
            </div>

            {/* Save Preset Modal */}
            {showSavePreset && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Nume preset"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePreset()
                    if (e.key === 'Escape') {
                      setShowSavePreset(false)
                      setPresetName('')
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={savePreset}
                    disabled={!presetName.trim()}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Salvează
                  </button>
                  <button
                    onClick={() => {
                      setShowSavePreset(false)
                      setPresetName('')
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            )}

            {/* Saved Presets */}
            {presets.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Presete salvate
                </div>
                <div className="space-y-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                    >
                      <button
                        onClick={() => loadPreset(preset)}
                        className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

