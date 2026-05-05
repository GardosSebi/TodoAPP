'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock, Save, Eye, EyeOff, Bell } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface UserData {
  id: string
  email: string
  name: string
  created_at: string
  updated_at: string
}

interface SettingsClientProps {
  initialUser: UserData
}

export default function SettingsClient({ initialUser }: SettingsClientProps) {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form fields
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [emailPrefLoading, setEmailPrefLoading] = useState(true)
  const [emailPrefSaving, setEmailPrefSaving] = useState(false)
  const [emailPrefMsg, setEmailPrefMsg] = useState('')
  const [upcomingTaskEmail, setUpcomingTaskEmail] = useState(true)
  const [upcomingHoursBefore, setUpcomingHoursBefore] = useState(24)
  const [overdueTaskEmail, setOverdueTaskEmail] = useState(true)
  const [dailyDigestEmail, setDailyDigestEmail] = useState(false)
  const [digestHourUtc, setDigestHourUtc] = useState(7)
  const [followUpReminderEmail, setFollowUpReminderEmail] = useState(true)
  const [inactiveContactEmail, setInactiveContactEmail] = useState(true)
  const [inactiveContactDays, setInactiveContactDays] = useState(30)
  const [newContactEmail, setNewContactEmail] = useState(true)
  const [contactStatusChangeEmail, setContactStatusChangeEmail] = useState(true)
  const [dealStageChangeEmail, setDealStageChangeEmail] = useState(true)
  const [dealClosingReminderEmail, setDealClosingReminderEmail] = useState(true)
  const [dealClosingDaysBefore, setDealClosingDaysBefore] = useState(3)
  const [dealWonLostEmail, setDealWonLostEmail] = useState(true)
  const [crmNoteAddedEmail, setCrmNoteAddedEmail] = useState(true)
  const [taskCompletedEmail, setTaskCompletedEmail] = useState(true)
  const [quietHoursStart, setQuietHoursStart] = useState<string>('')
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/email-notification-preferences')
        if (!res.ok) return
        const data = await res.json()
        const s = data.settings
        if (cancelled || !s) return
        setUpcomingTaskEmail(s.upcomingTaskEmail)
        setUpcomingHoursBefore(s.upcomingHoursBefore)
        setOverdueTaskEmail(s.overdueTaskEmail)
        setDailyDigestEmail(s.dailyDigestEmail)
        setDigestHourUtc(s.digestHourUtc)
        setFollowUpReminderEmail(s.followUpReminderEmail)
        setInactiveContactEmail(s.inactiveContactEmail)
        setInactiveContactDays(s.inactiveContactDays)
        setNewContactEmail(s.newContactEmail ?? true)
        setContactStatusChangeEmail(s.contactStatusChangeEmail ?? true)
        setDealStageChangeEmail(s.dealStageChangeEmail ?? true)
        setDealClosingReminderEmail(s.dealClosingReminderEmail ?? true)
        setDealClosingDaysBefore(s.dealClosingDaysBefore ?? 3)
        setDealWonLostEmail(s.dealWonLostEmail ?? true)
        setCrmNoteAddedEmail(s.crmNoteAddedEmail ?? true)
        setTaskCompletedEmail(s.taskCompletedEmail ?? true)
        setQuietHoursStart(s.quietHoursStart != null ? String(s.quietHoursStart) : '')
        setQuietHoursEnd(s.quietHoursEnd != null ? String(s.quietHoursEnd) : '')
      } finally {
        if (!cancelled) setEmailPrefLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveEmailPreferences = async () => {
    setEmailPrefSaving(true)
    setEmailPrefMsg('')
    try {
      const parseHour = (v: string) => {
        if (v.trim() === '') return null
        const n = parseInt(v, 10)
        if (Number.isNaN(n) || n < 0 || n > 23) return null
        return n
      }
      const res = await fetch('/api/user/email-notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upcomingTaskEmail,
          upcomingHoursBefore,
          overdueTaskEmail,
          dailyDigestEmail,
          digestHourUtc,
          followUpReminderEmail,
          inactiveContactEmail,
          inactiveContactDays,
          newContactEmail,
          contactStatusChangeEmail,
          dealStageChangeEmail,
          dealClosingReminderEmail,
          dealClosingDaysBefore,
          dealWonLostEmail,
          crmNoteAddedEmail,
          taskCompletedEmail,
          quietHoursStart: parseHour(quietHoursStart),
          quietHoursEnd: parseHour(quietHoursEnd),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setEmailPrefMsg(err.error || 'Nu s-au putut salva preferințele.')
        return
      }
      setEmailPrefMsg('Preferințe email salvate.')
    } catch {
      setEmailPrefMsg('Eroare la salvare.')
    } finally {
      setEmailPrefSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // Validate password if new password is provided
      if (newPassword) {
        if (newPassword.length < 8) {
          setError('Parola nouă trebuie să aibă cel puțin 8 caractere')
          setLoading(false)
          return
        }
        if (newPassword !== confirmPassword) {
          setError('Parolele nu se potrivesc')
          setLoading(false)
          return
        }
        if (!currentPassword) {
          setError('Parola curentă este necesară pentru a schimba parola')
          setLoading(false)
          return
        }
      }

      const updateData: any = {}
      if (name !== user.name) updateData.name = name
      if (email !== user.email) updateData.email = email
      if (newPassword) {
        updateData.currentPassword = currentPassword
        updateData.newPassword = newPassword
      }

      // Only send request if there are changes
      if (Object.keys(updateData).length === 0) {
        setError('Nu există modificări de salvat')
        setLoading(false)
        return
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || 'Eroare la actualizarea profilului')
        setLoading(false)
        return
      }

      const data = await res.json()
      setUser(data.user)
      setSuccess('Profil actualizat cu succes!')
      
      // Clear password fields
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Update session if email or name changed
      if (email !== user.email || name !== user.name) {
        await update({
          ...session,
          user: {
            ...session?.user,
            email: data.user.email,
            name: data.user.name,
          },
        })
      }

      // If email changed, sign out and redirect to login
      if (email !== user.email) {
        setTimeout(() => {
          signOut({ callbackUrl: '/login' })
        }, 2000)
      }
    } catch (err) {
      setError('Eroare la actualizarea profilului')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Setări Cont
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gestionează informațiile contului tău
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Nume
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Numele tău"
            maxLength={100}
            required
          />
        </div>

        {/* Email Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="email@example.com"
            required
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Dacă schimbi email-ul, vei fi deconectat și va trebui să te conectezi din nou.
          </p>
        </div>

        {/* Password Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Schimbă Parola
          </label>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Parola curentă
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Parola curentă"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Parola nouă
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Parola nouă (minim 8 caractere)"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Confirmă parola nouă
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirmă parola nouă"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Lasă câmpurile goale dacă nu vrei să schimbi parola.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificări email (CRM & sarcini)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Necesită <strong>SMTP</strong> pe server (<code className="text-xs">SMTP_*</code>). Dacă SMTP
            lipsește, aplicația poate folosi fallback SendGrid. Orele pentru digest sunt <strong>UTC</strong>.
            „Fără deranjare” folosește ceasul serverului (de obicei UTC pe VPS).
          </p>
          {emailPrefLoading ? (
            <p className="text-sm text-gray-500">Se încarcă...</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={upcomingTaskEmail}
                  onChange={(e) => setUpcomingTaskEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Memento sarcini aproape de termen
              </label>
              <div className="pl-6">
                <label className="text-xs text-gray-600 dark:text-gray-400">
                  Fereastră (ore înainte de termen, max 168)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={upcomingHoursBefore}
                  onChange={(e) => setUpcomingHoursBefore(Number(e.target.value))}
                  className="mt-1 w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={overdueTaskEmail}
                  onChange={(e) => setOverdueTaskEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Alerte sarcini depășite
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={dailyDigestEmail}
                  onChange={(e) => setDailyDigestEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Rezumat zilnic (ora UTC)
              </label>
              <div className="pl-6 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={digestHourUtc}
                  onChange={(e) => setDigestHourUtc(Number(e.target.value))}
                  className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
                <span className="text-xs text-gray-500">0–23 UTC</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={followUpReminderEmail}
                  onChange={(e) => setFollowUpReminderEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Follow-up CRM (tip FOLLOW_UP / reminder_at)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={inactiveContactEmail}
                  onChange={(e) => setInactiveContactEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Contacte inactive (max. 1 email / 7 zile)
              </label>
              <div className="pl-6">
                <label className="text-xs text-gray-600 dark:text-gray-400">Zile fără activitate</label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={inactiveContactDays}
                  onChange={(e) => setInactiveContactDays(Number(e.target.value))}
                  className="mt-1 w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 pt-3 border-t border-gray-200 dark:border-gray-600 mt-3">
                Echipă &amp; CRM (email către membrii workspace, fără expeditor)
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Contact nou adăugat
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={contactStatusChangeEmail}
                  onChange={(e) => setContactStatusChangeEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Schimbare status contact
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={dealStageChangeEmail}
                  onChange={(e) => setDealStageChangeEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Schimbare etapă oportunitate
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={dealClosingReminderEmail}
                  onChange={(e) => setDealClosingReminderEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Memento dată închidere deal (cron)
              </label>
              <div className="pl-6">
                <label className="text-xs text-gray-600 dark:text-gray-400">Zile înainte de expected close (0–30)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={dealClosingDaysBefore}
                  onChange={(e) => setDealClosingDaysBefore(Number(e.target.value))}
                  className="mt-1 w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={dealWonLostEmail}
                  onChange={(e) => setDealWonLostEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Oportunitate câștigată / pierdută
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={crmNoteAddedEmail}
                  onChange={(e) => setCrmNoteAddedEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Notă nouă (contact / companie / deal)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={taskCompletedEmail}
                  onChange={(e) => setTaskCompletedEmail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Sarcină finalizată (ceilalți din workspace)
              </label>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">Liniște de la (oră, gol = off)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="—"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="mt-1 w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">Liniște până la</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="—"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="mt-1 w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
              </div>
              {emailPrefMsg && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{emailPrefMsg}</p>
              )}
              <button
                type="button"
                onClick={saveEmailPreferences}
                disabled={emailPrefSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailPrefSaving ? 'Salvare...' : 'Salvează notificările email'}
              </button>
            </>
          )}
        </div>

        {/* Account Info */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Informații Cont
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium">Cont creat:</span>{' '}
              {new Date(user.created_at).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p>
              <span className="font-medium">Ultima actualizare:</span>{' '}
              {new Date(user.updated_at).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Salvare...' : 'Salvează modificările'}
          </button>
        </div>
      </form>
    </div>
  )
}

