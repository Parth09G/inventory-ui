import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { NewPaymentPage } from '@/features/payments/NewPaymentPage'

export const Route = createFileRoute('/_app/payments/new')({
  validateSearch: z.object({
    direction: z.enum(['received', 'paid']).catch('received').default('received'),
    party: z.coerce.number().int().optional().catch(undefined),
    bill: z.coerce.number().int().optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => requirePerm(context, 'payment.create'),
  component: function Page() {
    const s = Route.useSearch()
    return (
      <NewPaymentPage
        key={`${s.direction}-${s.party}-${s.bill}`}
        direction={s.direction}
        partyId={s.party}
        billId={s.bill}
      />
    )
  },
})
