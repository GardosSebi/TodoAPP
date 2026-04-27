'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CompanyItem {
  id: string
  name: string
  website: string | null
  industry: string | null
  size: string | null
  location: string | null
  status: 'LEAD' | 'ACTIVE_CUSTOMER' | 'PAST_CUSTOMER' | 'PARTNER' | 'INACTIVE'
  _count: {
    contacts: number
    deals: number
  }
}

interface CompaniesClientProps {
  initialCompanies: CompanyItem[]
}

export default function CompaniesClient({ initialCompanies }: CompaniesClientProps) {
  const [companies, setCompanies] = useState<CompanyItem[]>(initialCompanies)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'LEAD' | 'ACTIVE_CUSTOMER' | 'PAST_CUSTOMER' | 'PARTNER' | 'INACTIVE'>(
    'LEAD'
  )
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setName('')
    setWebsite('')
    setIndustry('')
    setSize('')
    setLocation('')
    setStatus('LEAD')
    setNotes('')
    setError('')
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Numele companiei este obligatoriu.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
          size: size.trim() || null,
          location: location.trim() || null,
          status,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut crea compania.')
        return
      }

      const created: CompanyItem = {
        id: data.company.id,
        name: data.company.name,
        website: data.company.website,
        industry: data.company.industry,
        size: data.company.size,
        location: data.company.location,
        status: data.company.status,
        _count: { contacts: 0, deals: 0 },
      }

      setCompanies((prev) => [created, ...prev])
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">CRM Companii</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{companies.length} companii</p>
        </div>
        <button
          onClick={() => {
            setShowForm((prev) => !prev)
            setError('')
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {showForm ? 'Închide' : 'Creează companie'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateCompany}
          className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nume companie *"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Website (ex: https://acme.com)"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industrie"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Dimensiune"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Locație"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="LEAD">LEAD</option>
            <option value="ACTIVE_CUSTOMER">ACTIVE_CUSTOMER</option>
            <option value="PAST_CUSTOMER">PAST_CUSTOMER</option>
            <option value="PARTNER">PARTNER</option>
            <option value="INACTIVE">INACTIVE</option>
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
              {loading ? 'Se salvează...' : 'Salvează compania'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/app/crm/companies/${company.id}`}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white">{company.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{company.website || 'Fără website'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{company.industry || 'Fără industrie'}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {company.status}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {company._count.contacts} contacts / {company._count.deals} deals
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
