import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { redirectIfSignedIn } from '@/app/auth'
import { LoginPage } from '@/features/auth/LoginPage'

export const Route = createFileRoute('/_public/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    reason: z.enum(['expired', 'removed']).optional(),
  }),
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
})
