import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

type S = components['schemas']
export type Purchase = S['Purchase']
export type PurchaseInput = S['PurchaseInput']
export type PurchaseReturnInput = S['PurchaseReturnInput']
export type PurchasesParams = NonNullable<operations['listPurchases']['parameters']['query']>

export const purchasesQuery = (params: PurchasesParams) =>
  queryOptions({
    queryKey: ['purchases', 'list', params],
    queryFn: () =>
      call(
        api.GET('/purchases', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } }),
      ),
    placeholderData: keepPreviousData,
  })

export const purchaseQuery = (id: number) =>
  queryOptions({
    queryKey: ['purchases', id],
    queryFn: () => call(api.GET('/purchases/{id}', { params: { path: { id } } })),
  })

/** Purchases change stock, average cost, dealer balances and the dashboard (ui-plan §1.2). */
function useInvalidateAfterPurchase() {
  const qc = useQueryClient()
  return () => {
    for (const key of [['purchases'], ['items'], ['parties'], ['payments'], ['dashboard']])
      void qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreatePurchase() {
  const invalidate = useInvalidateAfterPurchase()
  return useMutation({
    mutationFn: ({ body, key }: { body: PurchaseInput; key: string }) =>
      call(api.POST('/purchases', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export function useCancelPurchase() {
  const invalidate = useInvalidateAfterPurchase()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      call(api.POST('/purchases/{id}/cancel', { params: { path: { id } }, body: { reason } })),
    onSuccess: invalidate,
  })
}

export function useCreatePurchaseReturn() {
  const invalidate = useInvalidateAfterPurchase()
  return useMutation({
    mutationFn: ({ body, key }: { body: PurchaseReturnInput; key: string }) =>
      call(api.POST('/purchase-returns', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}
