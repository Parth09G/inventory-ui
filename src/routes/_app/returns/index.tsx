import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ReturnsPage } from '@/features/returns/ReturnsPage'

export const Route = createFileRoute('/_app/returns/')({
  validateSearch: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  component: ReturnsPage,
})
