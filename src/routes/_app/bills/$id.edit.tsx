import { createFileRoute } from '@tanstack/react-router'
import { billQuery } from '@/features/billing/api'
import { EditBillPage } from '@/features/billing/EditBillPage'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/bills/$id/edit')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(billQuery(params.id)),
      context.queryClient.ensureQueryData(settingsQuery()),
      context.queryClient.ensureQueryData(locationsQuery()),
    ]),
  component: function Page() {
    return <EditBillPage id={Route.useParams().id} />
  },
})
