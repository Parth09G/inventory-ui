import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { billQuery } from '@/features/billing/api'
import { NewReturnPage } from '@/features/returns/NewReturnPage'
import { locationsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/returns/new')({
  validateSearch: z.object({ bill: z.coerce.number().int().optional().catch(undefined) }),
  beforeLoad: ({ context, search }) => {
    requirePerm(context, 'return.create')
    // A return always starts from its bill.
    if (!search.bill) throw redirect({ to: '/bills' })
  },
  loaderDeps: ({ search }) => ({ bill: search.bill }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(billQuery(deps.bill!)),
      context.queryClient.ensureQueryData(locationsQuery()),
    ]),
  component: function Page() {
    return <NewReturnPage billId={Route.useSearch().bill!} />
  },
})
