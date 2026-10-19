import { queryOptions } from '@tanstack/react-query'
import { api, call } from '@/lib/api/client'
import { compact } from '@/lib/list'

export type Range = { from: string; to: string }

// Everything here is invalidated by ['dashboard'] after any save (ui-plan §1.2).
export const summaryQuery = (r: Range) =>
  queryOptions({
    queryKey: ['dashboard', 'summary', r],
    queryFn: () => call(api.GET('/dashboard/summary', { params: { query: r } })),
  })

export const trendQuery = (r: Range, bucket: 'day' | 'month') =>
  queryOptions({
    queryKey: ['dashboard', 'trend', r, bucket],
    queryFn: () => call(api.GET('/dashboard/sales-trend', { params: { query: { ...r, bucket } } })),
  })

export const categoryBreakdownQuery = (r: Range) =>
  queryOptions({
    queryKey: ['dashboard', 'categories', r],
    queryFn: () => call(api.GET('/dashboard/categories', { params: { query: r } })),
  })

export const topItemsQuery = (r: Range, kind: 'fast' | 'slow') =>
  queryOptions({
    queryKey: ['dashboard', 'top-items', r, kind],
    queryFn: () =>
      call(
        api.GET('/dashboard/top-items', { params: { query: compact({ ...r, kind, limit: 10 }) } }),
      ),
  })

export const lowStockQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: () => call(api.GET('/dashboard/low-stock')),
  })

export const pendingQuery = () =>
  queryOptions({
    queryKey: ['dashboard', 'pending'],
    queryFn: () => call(api.GET('/dashboard/pending')),
    refetchInterval: 60_000,
  })
