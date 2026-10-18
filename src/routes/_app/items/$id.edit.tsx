import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { requirePerm } from '@/app/auth'
import { categoriesQuery } from '@/features/catalogue/api'
import { itemQuery } from '@/features/inventory/api'
import { ItemFormPage } from '@/features/inventory/ItemFormPage'

export const Route = createFileRoute('/_app/items/$id/edit')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  beforeLoad: ({ context }) => requirePerm(context, 'item.manage'),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(itemQuery(params.id)),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]),
  component: function Page() {
    const { data } = useSuspenseQuery(itemQuery(Route.useParams().id))
    return <ItemFormPage item={data} />
  },
})
