import { createFileRoute } from '@tanstack/react-router'
import { requirePerm } from '@/app/auth'
import { UsersPage } from '@/features/users/UsersPage'

export const Route = createFileRoute('/_app/users')({
  beforeLoad: ({ context }) => requirePerm(context, 'user.manage'),
  component: UsersPage,
})
