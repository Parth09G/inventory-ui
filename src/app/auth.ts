import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { meQuery } from '@/features/auth/api'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/auth/supabase'

export type RouterContext = { queryClient: QueryClient }

/** beforeLoad for routes only signed-out users should see (login, forgot password). */
export async function redirectIfSignedIn() {
  const { data } = await supabase.auth.getSession()
  if (data.session) throw redirect({ to: '/' })
}

/**
 * beforeLoad for a route that needs a permission. Shapes the UI only: the server
 * enforces every permission (D-10).
 */
export function requirePerm(context: RouterContext, perm: string) {
  const me = context.queryClient.getQueryData(meQuery().queryKey)
  if (!hasPermission(me, perm)) throw redirect({ to: '/no-access', search: { perm } })
}
