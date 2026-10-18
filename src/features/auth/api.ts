import { queryOptions } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'

export const meQuery = () =>
  queryOptions({
    queryKey: ['me'],
    queryFn: () => call(api.GET('/me')),
    staleTime: 5 * 60_000,
  })
