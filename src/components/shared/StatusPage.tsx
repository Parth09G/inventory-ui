import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/** Full-page message for 404 / 403 / fatal errors. */
export function StatusPage({
  code,
  title,
  children,
}: {
  code: string
  title: string
  children?: ReactNode
}) {
  return (
    <main className="mx-auto grid max-w-lg gap-3 px-4 py-16 sm:px-6">
      <p className="code text-ink-muted">{code}</p>
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
      <p>
        <Link to="/" className="text-steel underline-offset-4 hover:underline">
          Go to the dashboard
        </Link>
      </p>
    </main>
  )
}
