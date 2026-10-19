import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requirePerm } from '@/app/auth'
import { TallyPage } from '@/features/tally/TallyPage'

export const Route = createFileRoute('/_app/tally')({
  validateSearch: z.object({
    tab: z.enum(['export', 'import', 'history']).optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => requirePerm(context, 'tally.export'),
  component: TallyPage,
})
