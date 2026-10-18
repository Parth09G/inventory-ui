import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { partyQuery } from '@/features/parties/api'
import { PartyFormPage } from '@/features/parties/PartyFormPage'

export const Route = createFileRoute('/_app/parties/$id/edit')({
  params: { parse: (p) => ({ id: Number(p.id) }), stringify: (p) => ({ id: String(p.id) }) },
  beforeLoad: ({ context }) => requirePerm(context, 'party.manage'),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(partyQuery(params.id)),
  component: function Page() {
    const { data } = useSuspenseQuery(partyQuery(Route.useParams().id))
    return <PartyFormPage party={data} />
  },
})
