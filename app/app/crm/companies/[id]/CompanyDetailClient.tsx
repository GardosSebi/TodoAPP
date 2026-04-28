'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CrmTimeline from '@/components/CrmTimeline'
import { companyStatusLabel } from '@/lib/crmLabels'

export default function CompanyDetailClient({ initialCompany, contacts }: { initialCompany: any; contacts: any[] }) {
  const router = useRouter()
  const [company, setCompany] = useState(initialCompany)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          website: company.website,
          industry: company.industry,
          size: company.size,
          location: company.location,
          status: company.status,
          notes: company.notes,
          primaryContactId: company.primaryContactId || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCompany(data.company)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Sigur vrei să ștergi această companie?')) return
    const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/app/crm/companies')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-5 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{company.name}</h1>

      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <input value={company.name || ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={company.website || ''} onChange={(e) => setCompany({ ...company, website: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={company.industry || ''} onChange={(e) => setCompany({ ...company, industry: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={company.size || ''} onChange={(e) => setCompany({ ...company, size: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={company.location || ''} onChange={(e) => setCompany({ ...company, location: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <select value={company.status || 'LEAD'} onChange={(e) => setCompany({ ...company, status: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="LEAD">{companyStatusLabel.LEAD}</option><option value="ACTIVE_CUSTOMER">{companyStatusLabel.ACTIVE_CUSTOMER}</option><option value="PAST_CUSTOMER">{companyStatusLabel.PAST_CUSTOMER}</option><option value="PARTNER">{companyStatusLabel.PARTNER}</option><option value="INACTIVE">{companyStatusLabel.INACTIVE}</option>
        </select>
        <select value={company.primaryContactId || ''} onChange={(e) => setCompany({ ...company, primaryContactId: e.target.value })} className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="">Fără contact principal</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <textarea value={company.notes || ''} onChange={(e) => setCompany({ ...company, notes: e.target.value })} rows={3} className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600">Șterge</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">{saving ? 'Se salvează...' : 'Salvează'}</button>
        </div>
      </form>

      <CrmTimeline companyId={company.id} />
    </div>
  )
}
