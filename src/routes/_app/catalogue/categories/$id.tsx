import { createFileRoute } from '@tanstack/react-router'
import { CategoryPage } from '@/features/catalogue/CategoryPage'
import { categoryQuery } from '@/features/catalogue/api'

export const Route = createFileRoute('/_app/catalogue/categories/$id')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoryQuery(params.id)),
  component: function Page() {
    return <CategoryPage id={Route.useParams().id} />
  },
})
