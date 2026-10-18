import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { partyQuery } from '@/features/parties/api'
import { PartyPage } from '@/features/parties/PartyPage'

export const Route = createFileRoute('/_app/parties/$id/')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  validateSearch: z.object({
    tab: z.enum(['ledger', 'details']).optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(partyQuery(params.id)),
  component: PartyPage,
})
