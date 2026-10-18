import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { NewCategoryPage } from '@/features/catalogue/NewCategoryPage'

export const Route = createFileRoute('/_app/catalogue/categories/new')({
  beforeLoad: ({ context }) => requirePerm(context, 'catalogue.manage'),
  component: NewCategoryPage,
})
