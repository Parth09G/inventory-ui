import { createFileRoute } from '@tanstack/react-router'
import { transferQuery } from '@/features/stock/api'
import { TransferPage } from '@/features/stock/TransferPage'

export const Route = createFileRoute('/_app/transfers/$id')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(transferQuery(params.id)),
  component: TransferPage,
})
