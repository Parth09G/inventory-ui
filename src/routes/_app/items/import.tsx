import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { categoriesQuery } from '@/features/catalogue/api'
import { ItemImportPage } from '@/features/inventory/ItemImportPage'

export const Route = createFileRoute('/_app/items/import')({
  beforeLoad: ({ context }) => requirePerm(context, 'item.manage'),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery()),
  component: ItemImportPage,
})
