import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { AuditLogPage } from '@/features/settings/AuditLogPage'

export const Route = createFileRoute('/_app/audit-log')({
  validateSearch: z.object({
    entity: z.string().optional().catch(undefined),
    action: z.string().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => requirePerm(context, 'audit.view'),
  component: AuditLogPage,
})
