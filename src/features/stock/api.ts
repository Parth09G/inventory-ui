import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

type S = components['schemas']
export type Transfer = S['Transfer']
export type TransferInput = S['TransferInput']
export type Adjustment = S['Adjustment']
export type AdjustmentInput = S['AdjustmentInput']
export type StockCountInput = S['StockCountInput']
export type StockCountPreview = S['StockCountPreview']
type ListParams = NonNullable<operations['listTransfers']['parameters']['query']>

export const transfersQuery = (params: ListParams) =>
  queryOptions({
    queryKey: ['transfers', 'list', params],
    queryFn: () =>
      call(
        api.GET('/stock-transfers', {
          params: { query: compact({ page_size: PAGE_SIZE, ...params }) },
        }),
      ),
    placeholderData: keepPreviousData,
  })

export const transferQuery = (id: number) =>
  queryOptions({
    queryKey: ['transfers', id],
    queryFn: () => call(api.GET('/stock-transfers/{id}', { params: { path: { id } } })),
  })

export const adjustmentsQuery = (params: ListParams) =>
  queryOptions({
    queryKey: ['adjustments', 'list', params],
    queryFn: () =>
      call(
        api.GET('/stock-adjustments', {
          params: { query: compact({ page_size: PAGE_SIZE, ...params }) },
        }),
      ),
    placeholderData: keepPreviousData,
  })

/** Stock moves change item stock, the dashboard and notifications (ui-plan §1.2). */
function useInvalidateStock(listKey: string) {
  const qc = useQueryClient()
  return () => {
    for (const key of [[listKey], ['items'], ['dashboard'], ['notifications']])
      void qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreateTransfer() {
  const invalidate = useInvalidateStock('transfers')
  return useMutation({
    mutationFn: ({ body, key }: { body: TransferInput; key: string }) =>
      call(api.POST('/stock-transfers', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export function useCreateAdjustment() {
  const invalidate = useInvalidateStock('adjustments')
  return useMutation({
    mutationFn: ({ body, key }: { body: AdjustmentInput; key: string }) =>
      call(
        api.POST('/stock-adjustments', { body, params: { header: { 'Idempotency-Key': key } } }),
      ),
    onSuccess: invalidate,
  })
}

export function usePreviewCount() {
  return useMutation({
    mutationFn: (body: StockCountInput) => call(api.POST('/stock-counts/preview', { body })),
  })
}

export function usePostCount() {
  const invalidate = useInvalidateStock('adjustments')
  return useMutation({
    mutationFn: ({ body, key }: { body: StockCountInput; key: string }) =>
      call(api.POST('/stock-counts', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export const ADJUST_REASON: Record<AdjustmentInput['reason'], string> = {
  damage: 'Damage',
  breakage: 'Breakage',
  wastage: 'Wastage',
  count_correction: 'Count correction',
  sample: 'Sample',
  other: 'Other',
}
