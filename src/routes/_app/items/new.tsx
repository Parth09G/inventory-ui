import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { categoriesQuery } from '@/features/catalogue/api'
import { ItemFormPage } from '@/features/inventory/ItemFormPage'

export const Route = createFileRoute('/_app/items/new')({
  validateSearch: z.object({ category_id: z.coerce.number().int().optional().catch(undefined) }),
  beforeLoad: ({ context }) => requirePerm(context, 'item.manage'),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery()),
  component: function Page() {
    return <ItemFormPage initialCategoryId={Route.useSearch().category_id} />
  },
})
