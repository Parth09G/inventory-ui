import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'

export const unreadNotificationsQuery = () =>
  queryOptions({
    queryKey: ['notifications', 'unread'],
    queryFn: () =>
      call(api.GET('/notifications', { params: { query: { unread_only: true, page_size: 10 } } })),
    refetchInterval: 60_000,
  })

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => call(api.POST('/notifications/read-all')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/notifications/{id}/read', { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
