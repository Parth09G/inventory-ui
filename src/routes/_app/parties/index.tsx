import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PartiesPage } from '@/features/parties/PartiesPage'
import { listSearch } from '@/lib/list'

export const Route = createFileRoute('/_app/parties/')({
  validateSearch: listSearch.extend({
    kind: z.enum(['customer', 'supplier']).optional().catch(undefined),
    balance: z.enum(['receivable', 'payable']).optional().catch(undefined),
  }),
  component: PartiesPage,
})
