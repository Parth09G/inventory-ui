import { createFileRoute } from '@tanstack/react-router'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'

// No redirectIfSignedIn: invite and recovery links arrive with a session.
export const Route = createFileRoute('/_public/set-password')({
  component: SetPasswordPage,
})
