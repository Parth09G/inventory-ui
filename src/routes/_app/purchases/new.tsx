import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { itemQuery } from '@/features/inventory/api'
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/purchases/new')({
  // ?item= prefills the first line (from low-stock lists).
  validateSearch: z.object({ item: z.coerce.number().int().optional().catch(undefined) }),
  beforeLoad: ({ context }) => requirePerm(context, 'purchase.create'),
  loaderDeps: ({ search }) => ({ item: search.item }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery()),
      context.queryClient.ensureQueryData(locationsQuery()),
      deps.item ? context.queryClient.ensureQueryData(itemQuery(deps.item)) : null,
    ]),
  component: function Page() {
    const { item } = Route.useSearch()
    const prefill = useQuery({ ...itemQuery(item ?? 0), enabled: !!item }).data
    return <NewPurchasePage key={item ?? 0} prefillItem={prefill} />
  },
})
