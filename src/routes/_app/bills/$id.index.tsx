import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { billQuery } from '@/features/billing/api'
import { BillPage } from '@/features/billing/BillPage'

export const Route = createFileRoute('/_app/bills/$id/')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  validateSearch: z.object({
    tab: z.enum(['bill', 'payments', 'einvoice', 'history']).optional().catch(undefined),
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(billQuery(params.id)),
  component: BillPage,
})
