import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PaymentsPage } from '@/features/payments/PaymentsPage'

export const Route = createFileRoute('/_app/payments/')({
  validateSearch: z.object({
    direction: z.enum(['received', 'paid']).optional().catch(undefined),
    mode: z.enum(['cash', 'upi', 'cheque', 'bank_transfer']).optional().catch(undefined),
    cheque_status: z.enum(['pending', 'cleared', 'bounced']).optional().catch(undefined),
    party_id: z.coerce.number().int().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  component: PaymentsPage,
})
