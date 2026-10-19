import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { purchaseQuery } from '@/features/purchases/api'
import { PurchaseReturnPage } from '@/features/purchases/PurchaseReturnPage'
import { unitsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/purchases/$id/return')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  beforeLoad: ({ context }) => requirePerm(context, 'purchase_return.create'),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(purchaseQuery(params.id)),
      context.queryClient.ensureQueryData(unitsQuery()),
    ]),
  component: PurchaseReturnPage,
})
