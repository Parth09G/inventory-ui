import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

export type Payment = components['schemas']['Payment']
export type PaymentInput = components['schemas']['PaymentInput']
export type PaymentsParams = NonNullable<operations['listPayments']['parameters']['query']>

export const paymentsQuery = (params: PaymentsParams) =>
  queryOptions({
    queryKey: ['payments', 'list', params],
    queryFn: () =>
      call(
        api.GET('/payments', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } }),
      ),
    placeholderData: keepPreviousData,
  })

export const paymentQuery = (id: number) =>
  queryOptions({
    queryKey: ['payments', id],
    queryFn: () => call(api.GET('/payments/{id}', { params: { path: { id } } })),
  })

/** A payment changes bills, purchases, party balances and the dashboard (ui-plan §1.2). */
function useInvalidateAfterPayment() {
  const qc = useQueryClient()
  return (p?: Payment) => {
    if (p) qc.setQueryData(paymentQuery(p.id).queryKey, p)
    for (const key of [['payments'], ['bills'], ['purchases'], ['parties'], ['dashboard']])
      void qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreatePayment() {
  const invalidate = useInvalidateAfterPayment()
  return useMutation({
    mutationFn: ({ body, key }: { body: PaymentInput; key: string }) =>
      call(api.POST('/payments', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export function useChequeStatus() {
  const invalidate = useInvalidateAfterPayment()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'cleared' | 'bounced' }) =>
      call(
        api.POST('/payments/{id}/cheque-status', { params: { path: { id } }, body: { status } }),
      ),
    onSuccess: invalidate,
  })
}

export function useCancelPayment() {
  const invalidate = useInvalidateAfterPayment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      call(api.POST('/payments/{id}/cancel', { params: { path: { id } }, body: { reason } })),
    onSuccess: invalidate,
  })
}

export function useReceipt() {
  return useMutation({
    mutationFn: (id: number) =>
      call(api.GET('/payments/{id}/receipt', { params: { path: { id } } })),
  })
}
