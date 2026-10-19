import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { monthStart } from '@/features/dashboard/period'
import { REPORTS, type ReportKey } from '@/features/reports/catalogue'
import { ReportPage } from '@/features/reports/ReportPage'
import { todayIST } from '@/lib/format'

export const Route = createFileRoute('/_app/reports/$key')({
  // Default period: this month to date.
  validateSearch: z.object({
    from: z
      .string()
      .catch(() => monthStart(todayIST()))
      .default(() => monthStart(todayIST())),
    to: z
      .string()
      .catch(() => todayIST())
      .default(() => todayIST()),
    location_id: z.coerce.number().int().optional().catch(undefined),
    category_id: z.coerce.number().int().optional().catch(undefined),
    party_id: z.coerce.number().int().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  beforeLoad: ({ context, params }) => {
    requirePerm(context, 'reports.view')
    if (!REPORTS.has(params.key as ReportKey)) throw notFound()
  },
  component: ReportPage,
})
