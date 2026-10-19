import { createFileRoute, notFound } from '@tanstack/react-router'
import { SECTIONS, SettingsPage, type Section } from '@/features/settings/SettingsPage'
import { locationsQuery, settingsQuery } from '@/lib/api/reference'

export const Route = createFileRoute('/_app/settings/$section')({
  beforeLoad: ({ params }) => {
    if (!(params.section in SECTIONS)) throw notFound()
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery()),
      context.queryClient.ensureQueryData(locationsQuery()),
    ]),
  component: function Page() {
    return <SettingsPage section={Route.useParams().section as Section} />
  },
})
