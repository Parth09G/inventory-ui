import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { categoriesQuery } from '@/features/catalogue/api'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { listSearch } from '@/lib/list'

export const Route = createFileRoute('/_app/inventory/')({
  validateSearch: listSearch.extend({
    category_id: z.coerce.number().int().optional().catch(undefined),
    location_id: z.coerce.number().int().optional().catch(undefined),
    stock_status: z.enum(['ok', 'low', 'out']).optional().catch(undefined),
    include_inactive: z.boolean().optional().catch(undefined),
    attr: z.record(z.string(), z.string()).optional().catch(undefined),
  }),
  loader: ({ context }) => void context.queryClient.prefetchQuery(categoriesQuery()),
  component: InventoryPage,
})
