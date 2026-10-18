import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/shared/PageHeader'

// The dashboard is built in T6.1.
export const Route = createFileRoute('/_app/')({
  component: () => <PageHeader title="Dashboard" />,
})
