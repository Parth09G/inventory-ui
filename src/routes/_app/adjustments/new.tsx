import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { NewAdjustmentPage } from '@/features/stock/NewAdjustmentPage'
import { locationsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/adjustments/new')({
  beforeLoad: ({ context }) => requirePerm(context, 'stock.adjust'),
  loader: ({ context }) => context.queryClient.ensureQueryData(locationsQuery()),
  component: NewAdjustmentPage,
})
