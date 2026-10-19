import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export const Route = createFileRoute('/_app/')({
  validateSearch: z.object({
    period: z.enum(['today', 'month', 'fy']).optional().catch(undefined),
  }),
  component: DashboardPage,
})
