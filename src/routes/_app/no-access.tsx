import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StatusPage } from '@/components/shared/StatusPage'

export const Route = createFileRoute('/_app/no-access')({
  validateSearch: z.object({ perm: z.string().optional() }),
  component: function NoAccess() {
    const { perm } = Route.useSearch()
    return (
      <StatusPage code="403" title="You do not have access to this page">
        <p className="text-ink-muted">
          Ask the owner (Super Admin) if you need it.
          {perm && (
            <>
              {' '}
              Required permission: <span className="code">{perm}</span>
            </>
          )}
        </p>
      </StatusPage>
    )
  },
})
