import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { PartyFormPage } from '@/features/parties/PartyFormPage'

export const Route = createFileRoute('/_app/parties/new')({
  validateSearch: z.object({
    kind: z.enum(['customer', 'supplier', 'both']).optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => requirePerm(context, 'party.manage'),
  component: function Page() {
    return <PartyFormPage kind={Route.useSearch().kind} />
  },
})
