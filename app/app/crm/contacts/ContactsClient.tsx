'use client'

import { useState } from 'react'
import Link from 'next/link'

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
}

interface ContactsClientProps {
  initialContacts: ContactItem[]
  companies: CompanyOption[]
}

export default function ContactsClient({ initialContacts, companies }: ContactsClientProps) {
  const [contacts, setContacts] = useState<ContactItem[]>(initialContacts)
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

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setJobTitle('')
    setStatus('LEAD')
    setCompanyId('')
    setNotes('')
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
          tags: [],
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
            <option value="LEAD">LEAD</option>
            <option value="PROSPECT">PROSPECT</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="PARTNER">PARTNER</option>
            <option value="INACTIVE">INACTIVE</option>
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
        {contacts.map((contact) => (
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
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {contact.status}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {contact.company?.name || 'Fără companie'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
