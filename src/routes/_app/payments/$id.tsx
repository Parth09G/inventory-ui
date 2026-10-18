import { createFileRoute } from '@tanstack/react-router'
import { paymentQuery } from '@/features/payments/api'
import { PaymentPage } from '@/features/payments/PaymentPage'

export const Route = createFileRoute('/_app/payments/$id')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(paymentQuery(params.id)),
  component: PaymentPage,
})
