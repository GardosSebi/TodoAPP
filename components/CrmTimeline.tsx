'use client'

import { useEffect, useState } from 'react'

interface CrmTimelineProps {
  contactId?: string
  companyId?: string
  dealId?: string
}

export default function CrmTimeline({ contactId, companyId, dealId }: CrmTimelineProps) {
  const [notes, setNotes] = useState<any[]>([])
  const [interactions, setInteractions] = useState<any[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [interactionType, setInteractionType] = useState('CALL')
  const [interactionSubject, setInteractionSubject] = useState('')
  const [interactionContent, setInteractionContent] = useState('')
  const [loading, setLoading] = useState(false)

  const query = new URLSearchParams({
    ...(contactId ? { contactId } : {}),
    ...(companyId ? { companyId } : {}),
    ...(dealId ? { dealId } : {}),
  }).toString()

  const loadTimeline = async () => {
    try {
      const [notesRes, interactionsRes] = await Promise.all([
        fetch(`/api/crm-notes?${query}`),
        fetch(`/api/interactions?${query}`),
      ])
      if (notesRes.ok) {
        const data = await notesRes.json()
        setNotes(data.notes || [])
      }
      if (interactionsRes.ok) {
        const data = await interactionsRes.json()
        setInteractions(data.interactions || [])
      }
    } catch (error) {
      // ignore timeline load errors
    }
  }

  useEffect(() => {
    loadTimeline()
  }, [contactId, companyId, dealId])

  const addNote = async () => {
    if (!noteContent.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/crm-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent,
          contactId: contactId || null,
          companyId: companyId || null,
          dealId: dealId || null,
        }),
      })
      if (res.ok) {
        setNoteContent('')
        await loadTimeline()
      }
    } finally {
      setLoading(false)
    }
  }

  const addInteraction = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: interactionType,
          subject: interactionSubject || null,
          content: interactionContent || null,
          contactId: contactId || null,
          companyId: companyId || null,
          dealId: dealId || null,
        }),
      })
      if (res.ok) {
        setInteractionSubject('')
        setInteractionContent('')
        await loadTimeline()
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteNote = async (id: string) => {
    await fetch(`/api/crm-notes/${id}`, { method: 'DELETE' })
    await loadTimeline()
  }

  const deleteInteraction = async (id: string) => {
    await fetch(`/api/interactions/${id}`, { method: 'DELETE' })
    await loadTimeline()
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Adaugă notiță</h3>
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          rows={3}
          placeholder="Scrie o notiță..."
          className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={loading || !noteContent.trim()}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
          >
            Salvează notița
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Adaugă interacțiune</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="CALL">Call</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">Meeting</option>
            <option value="FOLLOW_UP">Follow-up</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            value={interactionSubject}
            onChange={(e) => setInteractionSubject(e.target.value)}
            placeholder="Subiect"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
        </div>
        <textarea
          value={interactionContent}
          onChange={(e) => setInteractionContent(e.target.value)}
          rows={3}
          placeholder="Detalii interacțiune..."
          className="mt-2 w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={addInteraction}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
          >
            Salvează interacțiunea
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Timeline</h3>
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="text-sm border border-gray-200 dark:border-gray-700 rounded p-2">
              <div className="flex justify-between gap-2">
                <p className="text-gray-800 dark:text-gray-200">{note.content}</p>
                <button className="text-red-500" onClick={() => deleteNote(note.id)}>Șterge</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Notiță - {new Date(note.created_at).toLocaleString('ro-RO')}
              </p>
            </div>
          ))}
          {interactions.map((interaction) => (
            <div key={interaction.id} className="text-sm border border-gray-200 dark:border-gray-700 rounded p-2">
              <div className="flex justify-between gap-2">
                <p className="text-gray-800 dark:text-gray-200">
                  [{interaction.type}] {interaction.subject || 'Fără subiect'}
                  {interaction.content ? ` - ${interaction.content}` : ''}
                </p>
                <button className="text-red-500" onClick={() => deleteInteraction(interaction.id)}>Șterge</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Interacțiune - {new Date(interaction.happened_at).toLocaleString('ro-RO')}
              </p>
            </div>
          ))}
          {notes.length === 0 && interactions.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nu există activitate încă.</p>
          )}
        </div>
      </div>
    </div>
  )
}
