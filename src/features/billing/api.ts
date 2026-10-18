import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'
import type { Bill, BillInput } from './bill-form'

type S = components['schemas']
export type BillSummary = S['BillSummary']
export type ShortLine = S['ShortLine']
export type BillsParams = NonNullable<operations['listBills']['parameters']['query']>
export type CalcResult = NonNullable<
  operations['calculateBill']['responses'][200]['content']['application/json']
>

/** The bill version as an If-Match value (ETag "3"). */
export const ifMatch = (b: Pick<Bill, 'version'>) => `"${b.version}"`

export const billsQuery = (params: BillsParams) =>
  queryOptions({
    queryKey: ['bills', 'list', params],
    queryFn: () =>
      call(api.GET('/bills', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } })),
    placeholderData: keepPreviousData,
  })

export const billQuery = (id: number) =>
  queryOptions({
    queryKey: ['bills', id],
    queryFn: () => call(api.GET('/bills/{id}', { params: { path: { id } } })),
  })

export const revisionsQuery = (id: number) =>
  queryOptions({
    queryKey: ['bills', id, 'revisions'],
    queryFn: () => call(api.GET('/bills/{id}/revisions', { params: { path: { id } } })),
  })

export const priceHintsQuery = (
  itemId: number,
  unitId: number | undefined,
  partyId: number | undefined,
) =>
  queryOptions({
    queryKey: ['price-hints', itemId, unitId, partyId],
    queryFn: () =>
      call(
        api.GET('/items/{id}/price-hints', {
          params: { path: { id: itemId }, query: compact({ unit_id: unitId, party_id: partyId }) },
        }),
      ),
    staleTime: 60_000,
  })

export function calculateBill(body: BillInput, signal?: AbortSignal) {
  return call(api.POST('/bills/calculate', { body, signal }))
}

/** Everything a bill change can affect (ui-plan §1.2 invalidation matrix). */
export function useInvalidateAfterBill() {
  const qc = useQueryClient()
  return (bill?: Bill) => {
    if (bill) qc.setQueryData(billQuery(bill.id).queryKey, bill)
    for (const key of [
      ['bills'],
      ['items'],
      ['parties'],
      ['dashboard'],
      ['notifications'],
      ['payments'],
    ])
      void qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreateBill() {
  const invalidate = useInvalidateAfterBill()
  return useMutation({
    mutationFn: ({ body, key }: { body: BillInput; key: string }) =>
      call(api.POST('/bills', { body, params: { header: { 'Idempotency-Key': key } } })),
    onSuccess: invalidate,
  })
}

export function useUpdateBill() {
  const invalidate = useInvalidateAfterBill()
  return useMutation({
    mutationFn: ({
      id,
      version,
      body,
      reason,
    }: {
      id: number
      version: number
      body: BillInput
      reason: string
    }) =>
      call(
        api.PUT('/bills/{id}', {
          params: { path: { id }, header: { 'If-Match': ifMatch({ version }) } },
          body: { ...body, reason },
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteDraft() {
  const invalidate = useInvalidateAfterBill()
  return useMutation({
    mutationFn: (id: number) => call(api.DELETE('/bills/{id}', { params: { path: { id } } })),
    onSuccess: () => invalidate(),
  })
}

export function useCancelBill() {
  const invalidate = useInvalidateAfterBill()
  return useMutation({
    mutationFn: ({ bill, reason }: { bill: Bill; reason: string }) =>
      call(
        api.POST('/bills/{id}/cancel', {
          params: { path: { id: bill.id }, header: { 'If-Match': ifMatch(bill) } },
          body: { reason },
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useCopyToAccount() {
  const invalidate = useInvalidateAfterBill()
  return useMutation({
    mutationFn: ({ id, key }: { id: number; key: string }) =>
      call(
        api.POST('/bills/{id}/copy-to-account', {
          params: { path: { id }, header: { 'Idempotency-Key': key } },
          body: {},
        }),
      ),
    onSuccess: invalidate,
  })
}

export function useEInvoiceActions(id: number) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['bills', id] })
  return {
    generate: useMutation({
      mutationFn: () => call(api.POST('/bills/{id}/einvoice', { params: { path: { id } } })),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (reason: string) =>
        call(
          api.POST('/bills/{id}/einvoice/cancel', { params: { path: { id } }, body: { reason } }),
        ),
      onSuccess: refresh,
    }),
    ewaybill: useMutation({
      mutationFn: (body: {
        vehicle_no: string
        distance_km: number
        transport_mode?: 'road' | 'rail' | 'air' | 'ship'
      }) => call(api.POST('/bills/{id}/ewaybill', { params: { path: { id } }, body })),
      onSuccess: refresh,
    }),
  }
}

export function useBillDocuments(id: number) {
  return {
    pdf: useMutation({
      mutationFn: (copy?: 'original' | 'duplicate' | 'triplicate') =>
        call(api.GET('/bills/{id}/pdf', { params: { path: { id }, query: compact({ copy }) } })),
    }),
    share: useMutation({
      mutationFn: () => call(api.POST('/bills/{id}/share', { params: { path: { id } } })),
    }),
  }
}
