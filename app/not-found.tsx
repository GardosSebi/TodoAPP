import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">404</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Page not found</p>
        <Link
          href="/app"
          className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300"
        >
          Go back to dashboard
        </Link>
      </div>
    </div>
  )
}

