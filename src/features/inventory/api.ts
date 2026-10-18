import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

type S = components['schemas']
export type Item = S['Item']
export type ItemInput = S['ItemInput']
export type StockMovement = S['StockMovement']
export type ItemsParams = NonNullable<operations['listItems']['parameters']['query']>
export type MovementsParams = NonNullable<operations['listItemMovements']['parameters']['query']>

export const itemsQuery = (params: ItemsParams) =>
  queryOptions({
    queryKey: ['items', 'list', params],
    queryFn: () =>
      call(api.GET('/items', { params: { query: compact({ page_size: PAGE_SIZE, ...params }) } })),
    placeholderData: keepPreviousData,
  })

export const itemQuery = (id: number) =>
  queryOptions({
    queryKey: ['items', id],
    queryFn: () => call(api.GET('/items/{id}', { params: { path: { id } } })),
  })

export const movementsQuery = (id: number, params: MovementsParams) =>
  queryOptions({
    queryKey: ['items', id, 'movements', params],
    queryFn: () =>
      call(
        api.GET('/items/{id}/movements', {
          params: { path: { id }, query: compact({ page_size: PAGE_SIZE, ...params }) },
        }),
      ),
    placeholderData: keepPreviousData,
  })

/** Unit factors freeze once an item has any stock movement (FR-IN-07). */
export const hasMovementsQuery = (id: number) =>
  queryOptions({
    queryKey: ['items', id, 'movements', 'any'],
    queryFn: async () =>
      (
        await call(
          api.GET('/items/{id}/movements', { params: { path: { id }, query: { page_size: 1 } } }),
        )
      ).meta.total > 0,
  })

export function useSaveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ItemInput }) =>
      id
        ? call(api.PATCH('/items/{id}', { params: { path: { id } }, body }))
        : call(api.POST('/items', { body })),
    onSuccess: (item) => {
      qc.setQueryData(itemQuery(item.id).queryKey, item)
      void qc.invalidateQueries({ queryKey: ['items'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeactivateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      call(api.POST('/items/{id}/deactivate', { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  })
}

export const MOVEMENT_KIND: Record<StockMovement['kind'], string> = {
  opening: 'Opening stock',
  purchase: 'Purchase',
  purchase_return: 'Purchase return',
  sale: 'Sale',
  sale_reversal: 'Sale reversed',
  sales_return: 'Sales return',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  adjustment: 'Adjustment',
}
