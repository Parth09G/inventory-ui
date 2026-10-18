import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

export type CreditNote = components['schemas']['CreditNote']
export type ReturnInput = components['schemas']['ReturnInput']
export type ReturnsParams = NonNullable<operations['listReturns']['parameters']['query']>

export const returnsQuery = (params: ReturnsParams) =>
  queryOptions({
    queryKey: ['returns', 'list', params],
    queryFn: () =>
      call(
        api.GET('/returns', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } }),
      ),
    placeholderData: keepPreviousData,
  })

export const returnQuery = (id: number) =>
  queryOptions({
    queryKey: ['returns', id],
    queryFn: () => call(api.GET('/returns/{id}', { params: { path: { id } } })),
  })

/** Returns change stock (on approval), the bill's balance, the party's ledger (ui-plan §1.2). */
function useInvalidateAfterReturn() {
  const qc = useQueryClient()
  return (cn?: CreditNote) => {
    if (cn) qc.setQueryData(returnQuery(cn.id).queryKey, cn)
    for (const key of [
      ['returns'],
      ['bills'],
      ['items'],
      ['parties'],
      ['dashboard'],
      ['notifications'],
    ])
      void qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreateReturn() {
  const invalidate = useInvalidateAfterReturn()
  return useMutation({
    mutationFn: ({ body, key }: { body: ReturnInput; key: string }) =>
      call(api.POST('/returns', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export function useApproveReturn() {
  const invalidate = useInvalidateAfterReturn()
  return useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/returns/{id}/approve', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}

export function useRejectReturn() {
  const invalidate = useInvalidateAfterReturn()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      call(api.POST('/returns/{id}/reject', { params: { path: { id } }, body: { reason } })),
    onSuccess: invalidate,
  })
}

export function useCreditNotePdf() {
  return useMutation({
    mutationFn: (id: number) => call(api.GET('/returns/{id}/pdf', { params: { path: { id } } })),
  })
}
