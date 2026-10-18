import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BillsPage } from '@/features/billing/BillsPage'
import { listSearch } from '@/lib/list'

export const Route = createFileRoute('/_app/bills/')({
  validateSearch: listSearch.extend({
    tab: z.enum(['draft', 'cancelled']).optional().catch(undefined),
    bill_type: z.enum(['cash', 'account']).optional().catch(undefined),
    status: z.enum(['draft', 'active', 'cancelled']).optional().catch(undefined),
    payment_status: z.enum(['paid', 'partial', 'unpaid']).optional().catch(undefined),
    einvoice_status: z
      .enum(['not_required', 'pending', 'generated', 'failed', 'cancelled'])
      .optional()
      .catch(undefined),
    party_id: z.coerce.number().int().optional().catch(undefined),
    location_id: z.coerce.number().int().optional().catch(undefined),
    from: z.string().optional().catch(undefined),
    to: z.string().optional().catch(undefined),
    unlinked_account_bills: z.boolean().optional().catch(undefined),
  }),
  component: BillsPage,
})
