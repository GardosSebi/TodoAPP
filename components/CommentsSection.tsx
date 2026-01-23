'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, User, AtSign } from 'lucide-react'

interface Comment {
  id: string
  content: string
  mentions: string[]
  created_at: string
  user: {
    id: string
    name: string
    email: string
  }
}

interface WorkspaceMember {
  user: {
    id: string
    name: string
    email: string
  }
}

interface CommentsSectionProps {
  taskId: string
  workspaceMembers?: WorkspaceMember[]
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'acum'
  if (diffInSeconds < 3600) return `acum ${Math.floor(diffInSeconds / 60)} min`
  if (diffInSeconds < 86400) return `acum ${Math.floor(diffInSeconds / 3600)} ore`
  if (diffInSeconds < 604800) return `acum ${Math.floor(diffInSeconds / 86400)} zile`
  
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CommentsSection({
  taskId,
  workspaceMembers = [],
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionPosition, setMentionPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchComments()
  }, [taskId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionsRef.current && !mentionsRef.current.contains(event.target as Node)) {
        setShowMentions(false)
      }
    }

    if (showMentions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMentions])

  const fetchComments = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNewComment(value)

    // Check for @ mentions
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt)
        setMentionPosition(lastAtIndex)
        setShowMentions(true)
        return
      }
    }

    setShowMentions(false)
  }

  const insertMention = (member: WorkspaceMember['user']) => {
    const textBefore = newComment.substring(0, mentionPosition)
    const textAfter = newComment.substring(mentionPosition + mentionQuery.length + 1)
    const mentionText = `@${member.name} `
    setNewComment(textBefore + mentionText + textAfter)
    setShowMentions(false)
    setMentionQuery('')
    
    // Focus back on textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = textBefore.length + mentionText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setComments([...comments, data.comment])
        setNewComment('')
        setShowMentions(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Eroare la adăugarea comentariului')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
      alert('Eroare la adăugarea comentariului')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMembers = workspaceMembers.filter(
    (member) =>
      member.user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      member.user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const formatCommentContent = (content: string) => {
    // Highlight mentions
    const parts = content.split(/(@\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="font-medium text-blue-600 dark:text-blue-400"
          >
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AtSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Comentarii</h3>
        {comments.length > 0 && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          Se încarcă...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          Nu există comentarii. Fii primul care comentează!
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {comment.user.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(new Date(comment.created_at))}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {formatCommentContent(comment.content)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleCommentChange}
            onKeyDown={(e) => {
              if (showMentions && e.key === 'ArrowDown') {
                e.preventDefault()
                // Handle arrow navigation in mentions
              } else if (showMentions && e.key === 'Enter' && filteredMembers.length > 0) {
                e.preventDefault()
                insertMention(filteredMembers[0].user)
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSubmit(e)
              }
            }}
            placeholder="Adaugă un comentariu... (folosește @ pentru a menționa)"
            rows={3}
            className="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="absolute bottom-2 right-2 p-1.5 text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Mentions Dropdown */}
        {showMentions && filteredMembers.length > 0 && (
          <div
            ref={mentionsRef}
            className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
          >
            {filteredMembers.map((member) => (
              <button
                key={member.user.id}
                type="button"
                onClick={() => insertMention(member.user)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {member.user.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {member.user.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}

