import { createFileRoute } from '@tanstack/react-router'
import { returnQuery } from '@/features/returns/api'
import { ReturnPage } from '@/features/returns/ReturnPage'

export const Route = createFileRoute('/_app/returns/$id')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(returnQuery(params.id)),
  component: ReturnPage,
})
