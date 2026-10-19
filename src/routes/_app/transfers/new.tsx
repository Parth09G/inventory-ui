import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { itemQuery } from '@/features/inventory/api'
import { NewTransferPage } from '@/features/stock/NewTransferPage'
import { locationsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/transfers/new')({
  // Prefill from low-stock lists and bill shortages: ?item=&from=&to=
  validateSearch: z.object({
    item: z.coerce.number().int().optional().catch(undefined),
    from: z.coerce.number().int().optional().catch(undefined),
    to: z.coerce.number().int().optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => requirePerm(context, 'stock.transfer'),
  loaderDeps: ({ search }) => ({ item: search.item }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(locationsQuery()),
      deps.item ? context.queryClient.ensureQueryData(itemQuery(deps.item)) : null,
    ]),
  component: function Page() {
    const s = Route.useSearch()
    const item = useQuery({ ...itemQuery(s.item ?? 0), enabled: !!s.item }).data
    return (
      <NewTransferPage key={`${s.item}-${s.from}-${s.to}`} item={item} from={s.from} to={s.to} />
    )
  },
})
