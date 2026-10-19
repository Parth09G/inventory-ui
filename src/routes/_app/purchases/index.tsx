import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PurchasesPage } from '@/features/purchases/PurchasesPage'
import { listSearch } from '@/lib/list'

export const Route = createFileRoute('/_app/purchases/')({
  validateSearch: listSearch.extend({
    party_id: z.coerce.number().int().optional().catch(undefined),
    location_id: z.coerce.number().int().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
  }),
  component: PurchasesPage,
})
