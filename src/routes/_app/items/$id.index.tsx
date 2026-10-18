import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { itemQuery } from '@/features/inventory/api'
import { ItemPage } from '@/features/inventory/ItemPage'

export const Route = createFileRoute('/_app/items/$id/')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  validateSearch: z.object({
    tab: z.enum(['stock', 'ledger']).optional().catch(undefined),
    loc: z.coerce.number().int().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    page: z.coerce.number().int().min(1).optional().catch(undefined),
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(itemQuery(params.id)),
  component: ItemPage,
})
