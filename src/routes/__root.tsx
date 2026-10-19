import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { RouterContext } from '@/app/auth'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusPage } from '@/components/shared/StatusPage'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <TooltipProvider delayDuration={400}>
      <DemoBanner />
      <Outlet />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  ),
  notFoundComponent: () => (
    <StatusPage code="404" title="Page not found">
      <p className="text-ink-muted">The address may be mistyped, or the page was moved.</p>
    </StatusPage>
  ),
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-lg px-4 py-16">
      <ErrorState error={error} onRetry={reset} title="This page could not be shown" />
    </main>
  ),
})
