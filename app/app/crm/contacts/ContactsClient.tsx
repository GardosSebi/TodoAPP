'use client'

import { useState } from 'react'
import Link from 'next/link'
import { contactStatusBadgeClass, contactStatusLabel } from '@/lib/crmLabels'

interface CompanyOption {
  id: string
  name: string
}

interface ContactItem {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  status: 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'INACTIVE'
  company: {
    id: string
    name: string
  } | null
  tags?: string[]
}

interface ContactsClientProps {
  initialContacts: ContactItem[]
  companies: CompanyOption[]
}

export default function ContactsClient({ initialContacts, companies }: ContactsClientProps) {
  const [contacts, setContacts] = useState<ContactItem[]>(initialContacts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [tagFilter, setTagFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [status, setStatus] = useState<'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'INACTIVE'>('LEAD')
  const [companyId, setCompanyId] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  const parseTags = (value: string) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    )

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setJobTitle('')
    setStatus('LEAD')
    setCompanyId('')
    setNotes('')
    setTagsInput('')
    setError('')
  }

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prenumele și numele sunt obligatorii.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          status,
          companyId: companyId || null,
          notes: notes.trim() || null,
          tags: parseTags(tagsInput),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut crea contactul.')
        return
      }

      const selectedCompany = companies.find((c) => c.id === companyId) || null
      const created: ContactItem = {
        id: data.contact.id,
        first_name: data.contact.first_name,
        last_name: data.contact.last_name,
        email: data.contact.email,
        phone: data.contact.phone,
        status: data.contact.status,
        tags: data.contact.tags || [],
        company: selectedCompany ? { id: selectedCompany.id, name: selectedCompany.name } : null,
      }

      setContacts((prev) => [created, ...prev])
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError('Eroare la conectare cu serverul.')
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter((contact) => {
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(query) ||
      (contact.email || '').toLowerCase().includes(query) ||
      (contact.company?.name || '').toLowerCase().includes(query)

    const matchesStatus = statusFilter === 'ALL' || contact.status === statusFilter
    const currentTagFilter = tagFilter.trim().toLowerCase()
    const matchesTag =
      !currentTagFilter || (contact.tags || []).some((tag) => tag.toLowerCase().includes(currentTagFilter))
    return matchesSearch && matchesStatus && matchesTag
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">CRM Contacte</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{contacts.length} contacte</p>
        </div>
        <button
          onClick={() => {
            setShowForm((prev) => !prev)
            setError('')
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {showForm ? 'Închide' : 'Creează contact'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută contacte după nume, email sau companie..."
          className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="ALL">Toate statusurile</option>
          <option value="LEAD">Lead</option>
          <option value="PROSPECT">Prospect</option>
          <option value="CUSTOMER">Client</option>
          <option value="PARTNER">Partener</option>
          <option value="INACTIVE">Inactiv</option>
        </select>
        <input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Filtru după etichetă..."
          className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateContact}
          className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Prenume *"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Nume *"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Funcție"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="LEAD">Lead</option>
            <option value="PROSPECT">Prospect</option>
            <option value="CUSTOMER">Client</option>
            <option value="PARTNER">Partener</option>
            <option value="INACTIVE">Inactiv</option>
          </select>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="">Fără companie</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notițe"
            rows={3}
            className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Etichete (separate prin virgulă): client, urgent, webinar"
            className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          {error && <p className="md:col-span-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Se salvează...' : 'Salvează contactul'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/app/crm/contacts/${contact.id}`}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{contact.email || 'Fără email'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{contact.phone || 'Fără telefon'}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded ${contactStatusBadgeClass[contact.status]}`}>
                {contactStatusLabel[contact.status]}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {contact.company?.name || 'Fără companie'}
              </span>
            </div>
            {(contact.tags || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(contact.tags || []).slice(0, 4).map((tag) => (
                  <span
                    key={`${contact.id}-${tag}`}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
      {filteredContacts.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Nu există contacte pentru filtrele selectate.
        </div>
      )}
    </div>
  )
}
