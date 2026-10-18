import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { NewBillPage } from '@/features/billing/NewBillPage'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/bills/new')({
  validateSearch: z.object({ type: z.enum(['cash', 'account']).catch('cash').default('cash') }),
  beforeLoad: ({ context }) => requirePerm(context, 'bill.create'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery()),
      context.queryClient.ensureQueryData(locationsQuery()),
    ]),
  component: function Page() {
    return <NewBillPage type={Route.useSearch().type} />
  },
})
