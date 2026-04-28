'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CrmTimeline from '@/components/CrmTimeline'
import { dealStageLabel } from '@/lib/crmLabels'

export default function DealDetailClient({ initialDeal, companies, contacts }: { initialDeal: any; companies: any[]; contacts: any[] }) {
  const router = useRouter()
  const [deal, setDeal] = useState(initialDeal)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: deal.title,
          stage: deal.stage,
          value: Number(deal.value || 0),
          companyId: deal.companyId || null,
          contactId: deal.contactId || null,
          description: deal.description || null,
          expected_close: deal.expected_close ? new Date(deal.expected_close).toISOString() : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDeal(data.deal)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Sigur vrei să ștergi această oportunitate?')) return
    const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/app/crm/deals')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-5 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{deal.title}</h1>
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <input value={deal.title || ''} onChange={(e) => setDeal({ ...deal, title: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <input value={deal.value ?? ''} onChange={(e) => setDeal({ ...deal, value: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <select value={deal.stage || 'NEW'} onChange={(e) => setDeal({ ...deal, stage: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="NEW">{dealStageLabel.NEW}</option><option value="QUALIFIED">{dealStageLabel.QUALIFIED}</option><option value="PROPOSAL">{dealStageLabel.PROPOSAL}</option><option value="NEGOTIATION">{dealStageLabel.NEGOTIATION}</option><option value="WON">{dealStageLabel.WON}</option><option value="LOST">{dealStageLabel.LOST}</option>
        </select>
        <input type="date" value={deal.expected_close ? new Date(deal.expected_close).toISOString().split('T')[0] : ''} onChange={(e) => setDeal({ ...deal, expected_close: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <select value={deal.companyId || ''} onChange={(e) => setDeal({ ...deal, companyId: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="">Fără companie</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={deal.contactId || ''} onChange={(e) => setDeal({ ...deal, contactId: e.target.value })} className="px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
          <option value="">Fără contact</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <textarea value={deal.description || ''} onChange={(e) => setDeal({ ...deal, description: e.target.value })} rows={3} className="md:col-span-2 px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600">Șterge</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">{saving ? 'Se salvează...' : 'Salvează'}</button>
        </div>
      </form>
      <CrmTimeline dealId={deal.id} />
    </div>
  )
}
