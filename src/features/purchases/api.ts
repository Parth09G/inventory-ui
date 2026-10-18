import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import type { components, operations } from '@/lib/api/schema'
import { compact, PAGE_SIZE } from '@/lib/list'

export type Purchase = components['schemas']['Purchase']
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
