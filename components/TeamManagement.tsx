'use client'

import { useState, useEffect } from 'react'
import { Users, X, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TeamMember {
  id: string
  user: {
    id: string
    email: string
    created_at: string
  }
  created_at: string
}

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchTeamMembers()
  }, [])

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/team')
      if (res.ok) {
        const data = await res.json()
        setTeamMembers(data.teamMembers || [])
      }
    } catch (error) {
      // Error fetching team members
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        const data = await res.json()
        setTeamMembers((prev) => [data.teamMember, ...prev])
        setEmail('')
        setShowAddMember(false)
        setSuccess('Team member added successfully!')
        setError('')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to add team member')
        setSuccess('')
      }
    } catch (error) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return
    }

    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTeamMembers((prev) => prev.filter((m) => m.id !== memberId))
      }
    } catch (error) {
      // Error removing team member
    }
  }

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4" />
          Team Members
        </h3>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showAddMember && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddMember}
            className="mb-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="User email"
              className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">{success}</p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 dark:bg-blue-500 rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMember(false)
                  setEmail('')
                  setError('')
                  setSuccess('')
                }}
                className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-1">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group"
          >
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {member.user.email}
            </span>
            <button
              onClick={() => handleRemoveMember(member.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {teamMembers.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
            No team members yet
          </p>
        )}
      </div>
    </div>
  )
}

