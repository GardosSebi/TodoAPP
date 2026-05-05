'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token?.trim()) {
      setStatus('err')
      setMessage('Link invalid — lipsește tokenul de confirmare.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok) {
          setStatus('ok')
          setMessage(data.message || 'Contul tău este activ. Te poți conecta.')
        } else {
          setStatus('err')
          setMessage(data.error || 'Nu am putut activa contul.')
        }
      } catch {
        if (!cancelled) {
          setStatus('err')
          setMessage('Eroare de rețea. Încearcă din nou.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Confirmare cont</h1>
        {status === 'loading' && (
          <p className="text-gray-600 dark:text-gray-400">Se activează contul...</p>
        )}
        {status === 'ok' && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-green-800 dark:text-green-200">
            {message}
          </div>
        )}
        {status === 'err' && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-red-800 dark:text-red-200">
            {message}
          </div>
        )}
        <Link
          href="/login"
          className="inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
        >
          Mergi la autentificare
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400">Se încarcă...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
