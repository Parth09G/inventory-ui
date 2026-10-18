import { useQuery } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

export type Job = components['schemas']['Job']

export const isFinished = (j: Job | undefined) =>
  j?.status === 'succeeded' || j?.status === 'failed'

/** Polls GET /jobs/{id} every 2 s until the job succeeds or fails (D-22). */
export function useJob(id: string | undefined, initial?: Job) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => call(api.GET('/jobs/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    initialData: initial,
    refetchInterval: (q) => (isFinished(q.state.data) ? false : 2000),
  })
}
