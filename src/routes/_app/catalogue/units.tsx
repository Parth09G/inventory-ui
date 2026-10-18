import { createFileRoute } from '@tanstack/react-router'
import { UnitsPage } from '@/features/catalogue/UnitsPage'
import { unitsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/catalogue/units')({
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsQuery()),
  component: UnitsPage,
})
