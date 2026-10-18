import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { meQuery } from '@/features/auth/api'
import type { components } from '@/lib/api/schema'

export type Me = components['schemas']['Me']
export type BillAction = components['schemas']['Bill']['allowed_actions'][number]

/** Permission keys from GET /me (D-10). The server still enforces every one. */
export function useMe(): Me | undefined {
  return useQuery(meQuery()).data
}

export function hasPermission(me: Me | undefined, perm: string): boolean {
  return !!me?.permissions?.includes(perm)
}

export function useCan(perm: string): boolean {
  return hasPermission(useMe(), perm)
}

export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: string
  children: ReactNode
  fallback?: ReactNode
}) {
  return useCan(perm) ? children : fallback
}

/** Bill actions come only from the server's allowed_actions. */
export function hasAction(
  doc: { allowed_actions?: readonly string[] } | undefined,
  action: BillAction,
): boolean {
  return !!doc?.allowed_actions?.includes(action)
}
