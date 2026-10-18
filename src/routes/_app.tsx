import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '@/features/auth/api'
import { AppShell } from '@/components/shell/AppShell'
import { isProblem } from '@/lib/api/problem'
import { locationsQuery, statesQuery, unitsQuery } from '@/lib/api/reference'
import { supabase } from '@/lib/auth/supabase'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw redirect({ to: '/login', search: { redirect: location.href } })
    try {
      await context.queryClient.ensureQueryData(meQuery())
    } catch (e) {
      // Signed in to Supabase but unknown or deactivated in the app (FR-AU-03).
      if (isProblem(e) && e.status === 401) {
        await supabase.auth.signOut()
        throw redirect({ to: '/login', search: { reason: 'removed' } })
      }
      throw e
    }
    const qc = context.queryClient
    void qc.prefetchQuery(locationsQuery())
    void qc.prefetchQuery(unitsQuery())
    void qc.prefetchQuery(statesQuery())
  },
  component: AppShell,
})
