'use client'

import { useState } from 'react'
import Link from 'next/link'
import { dealStageBadgeClass, dealStageLabel } from '@/lib/crmLabels'

type DealStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

interface DealItem {
  id: string
  title: string
  stage: DealStage
  value: number
  company: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
}

interface CompanyOption {
  id: string
  name: string
}

interface ContactOption {
  id: string
  first_name: string
  last_name: string
}

interface DealsClientProps {
  initialDeals: DealItem[]
  companies: CompanyOption[]
  contacts: ContactOption[]
}

export default function DealsClient({ initialDeals, companies, contacts }: DealsClientProps) {
  const [deals, setDeals] = useState<DealItem[]>(initialDeals)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<'ALL' | DealStage>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<DealStage>('NEW')
  const [value, setValue] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [contactId, setContactId] = useState('')
  const [description, setDescription] = useState('')
  const [expectedClose, setExpectedClose] = useState('')

  const resetForm = () => {
    setTitle('')
    setStage('NEW')
    setValue('')
    setCompanyId('')
    setContactId('')
    setDescription('')
    setExpectedClose('')
    setError('')
  }

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Titlul oportunității este obligatoriu.')
      return
    }

    const parsedValue = value.trim() ? Number(value) : 0
    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      setError('Valoarea trebuie să fie un număr valid mai mare sau egal cu 0.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          stage,
          value: parsedValue,
          companyId: companyId || null,
          contactId: contactId || null,
          description: description.trim() || null,
          expected_close: expectedClose ? new Date(expectedClose).toISOString() : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut crea oportunitatea.')
        return
      }

      const selectedCompany = companies.find((c) => c.id === companyId) || null
      const selectedContact = contacts.find((c) => c.id === contactId) || null

      const created: DealItem = {
        id: data.deal.id,
        title: data.deal.title,
        stage: data.deal.stage,
        value: data.deal.value,
        company: selectedCompany ? { id: selectedCompany.id, name: selectedCompany.name } : null,
        contact: selectedContact
          ? {
              id: selectedContact.id,
              first_name: selectedContact.first_name,
              last_name: selectedContact.last_name,
            }
          : null,
      }

      setDeals((prev) => [created, ...prev])
      resetForm()
      setShowForm(false)
    } catch {
      setError('Eroare la conectare cu serverul.')
    } finally {
      setLoading(false)
    }
  }

  const filteredDeals = deals.filter((deal) => {
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      deal.title.toLowerCase().includes(query) ||
      (deal.company?.name || '').toLowerCase().includes(query) ||
      `${deal.contact?.first_name || ''} ${deal.contact?.last_name || ''}`.toLowerCase().includes(query)

    const matchesStage = stageFilter === 'ALL' || deal.stage === stageFilter
    return matchesSearch && matchesStage
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">CRM Oportunități</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{deals.length} oportunități</p>
        </div>
        <button
          onClick={() => {
            setShowForm((prev) => !prev)
            setError('')
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {showForm ? 'Închide' : 'Creează oportunitate'}
        </button>
      </div>

      <div className="mb-4 flex flex-col md:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută oportunități după titlu, companie sau contact..."
          className="flex-1 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as 'ALL' | DealStage)}
          className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="ALL">Toate stadiile</option>
          <option value="NEW">Nou</option>
          <option value="QUALIFIED">Calificat</option>
          <option value="PROPOSAL">Propunere</option>
          <option value="NEGOTIATION">Negociere</option>
          <option value="WON">Câștigat</option>
          <option value="LOST">Pierdut</option>
        </select>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateDeal}
          className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titlu oportunitate *"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Valoare (EUR)"
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />

          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStage)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="NEW">Nou</option>
            <option value="QUALIFIED">Calificat</option>
            <option value="PROPOSAL">Propunere</option>
            <option value="NEGOTIATION">Negociere</option>
            <option value="WON">Câștigat</option>
            <option value="LOST">Pierdut</option>
          </select>

          <input
            type="date"
            value={expectedClose}
            onChange={(e) => setExpectedClose(e.target.value)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          />

          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="">Fără companie</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>

          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="">Fără contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.first_name} {contact.last_name}
              </option>
            ))}
          </select>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descriere"
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
              {loading ? 'Se salvează...' : 'Salvează oportunitatea'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDeals.map((deal) => (
          <Link
            key={deal.id}
            href={`/app/crm/deals/${deal.id}`}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white">{deal.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{deal.company?.name || 'Fără companie'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : 'Fără contact'}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded ${dealStageBadgeClass[deal.stage]}`}>
                {dealStageLabel[deal.stage]}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{deal.value} EUR</span>
            </div>
          </Link>
        ))}
      </div>
      {filteredDeals.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Nu există oportunități pentru filtrele selectate.
        </div>
      )}
    </div>
  )
}
