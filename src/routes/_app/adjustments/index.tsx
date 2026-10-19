import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdjustmentsPage } from '@/features/stock/AdjustmentsPage'

export const Route = createFileRoute('/_app/adjustments/')({
  validateSearch: z.object({
    location_id: z.coerce.number().int().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  component: AdjustmentsPage,
})
