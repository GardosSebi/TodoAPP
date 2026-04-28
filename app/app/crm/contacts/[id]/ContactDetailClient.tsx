'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CrmTimeline from '@/components/CrmTimeline'
import { contactStatusLabel } from '@/lib/crmLabels'

export default function ContactDetailClient({ initialContact, companies }: { initialContact: any; companies: any[] }) {
  const router = useRouter()
  const [contact, setContact] = useState(initialContact)
  const [saving, setSaving] = useState(false)
  const [tagsInput, setTagsInput] = useState(((initialContact.tags || []) as string[]).join(', '))

  const parseTags = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          job_title: contact.job_title,
          status: contact.status,
          companyId: contact.companyId || null,
          notes: contact.notes,
          tags: parseTags(tagsInput),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setContact(data.contact)
        setTagsInput(((data.contact.tags || []) as string[]).join(', '))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Sigur vrei să ștergi acest contact?')) return
    const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/app/crm/contacts')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-5 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {contact.first_name} {contact.last_name}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">Detalii contact și istoric interacțiuni</p>

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <input value={contact.first_name || ''} onChange={(e) => setContact({ ...contact, first_name: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={contact.last_name || ''} onChange={(e) => setContact({ ...contact, last_name: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={contact.email || ''} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={contact.phone || ''} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={contact.job_title || ''} onChange={(e) => setContact({ ...contact, job_title: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <select value={contact.status || 'LEAD'} onChange={(e) => setContact({ ...contact, status: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="LEAD">{contactStatusLabel.LEAD}</option><option value="PROSPECT">{contactStatusLabel.PROSPECT}</option><option value="CUSTOMER">{contactStatusLabel.CUSTOMER}</option><option value="PARTNER">{contactStatusLabel.PARTNER}</option><option value="INACTIVE">{contactStatusLabel.INACTIVE}</option>
        </select>
        <select value={contact.companyId || ''} onChange={(e) => setContact({ ...contact, companyId: e.target.value })} className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="">Fără companie</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Etichete (separate prin virgulă)"
          className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
        <p className="md:col-span-2 -mt-1 text-xs text-gray-500 dark:text-gray-400">
          Exemplu: client, prioritar, onboarding
        </p>
        <textarea value={contact.notes || ''} onChange={(e) => setContact({ ...contact, notes: e.target.value })} rows={3} className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600">Șterge</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">{saving ? 'Se salvează...' : 'Salvează'}</button>
        </div>
      </form>

      <CrmTimeline contactId={contact.id} />
    </div>
  )
}
