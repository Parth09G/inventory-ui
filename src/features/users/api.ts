import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type User = components['schemas']['User']
export type UserInvite = components['schemas']['UserInvite']
export type UserPatch = components['schemas']['UserPatch']

export const usersQuery = () =>
  queryOptions({ queryKey: ['users'], queryFn: () => call(api.GET('/users')) })

function useUsersMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export const useInviteUser = () =>
  useUsersMutation((body: UserInvite) => call(api.POST('/users', { body })))
export const useUpdateUser = () =>
  useUsersMutation(({ id, body }: { id: string; body: UserPatch }) =>
    call(api.PATCH('/users/{id}', { params: { path: { id } }, body })),
  )
export const useDeactivateUser = () =>
  useUsersMutation((id: string) =>
    call(api.POST('/users/{id}/deactivate', { params: { path: { id } } })),
  )
export const useReactivateUser = () =>
  useUsersMutation((id: string) =>
    call(api.POST('/users/{id}/reactivate', { params: { path: { id } } })),
  )
export const useResetPassword = () =>
  useMutation({
    mutationFn: (id: string) =>
      call(api.POST('/users/{id}/password-reset', { params: { path: { id } } })),
  })
