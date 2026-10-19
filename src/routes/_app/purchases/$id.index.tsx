import { createFileRoute } from '@tanstack/react-router'
import { purchaseQuery } from '@/features/purchases/api'
import { PurchasePage } from '@/features/purchases/PurchasePage'

export const Route = createFileRoute('/_app/purchases/$id/')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(purchaseQuery(params.id)),
  component: PurchasePage,
})
