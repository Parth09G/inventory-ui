import { createFileRoute } from '@tanstack/react-router'
import { redirectIfSignedIn } from '@/app/auth'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'

export const Route = createFileRoute('/_public/forgot-password')({
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
})
