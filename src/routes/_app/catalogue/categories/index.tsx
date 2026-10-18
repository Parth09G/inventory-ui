import { createFileRoute } from '@tanstack/react-router'
import { CategoriesPage } from '@/features/catalogue/CategoriesPage'
import { categoriesQuery } from '@/features/catalogue/api'

export const Route = createFileRoute('/_app/catalogue/categories/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery()),
  component: CategoriesPage,
})
