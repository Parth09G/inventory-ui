import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { queryClient } from '@/app/query-client'
import { router } from '@/app/router'
import { applySavedDensity } from '@/hooks/useDensity'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { signOut } from '@/lib/auth/session'
import '@/styles/index.css'

applySavedDensity()

// Demo mode: answer API and sign-in calls from an in-browser mock (src/mocks).
if (import.meta.env.VITE_DEMO === 'true') await (await import('@/mocks/start')).startDemo()

// A 401 on any call except /me (handled by the _app guard) means the session ended.
setUnauthenticatedHandler((url) => {
  if (new URL(url).pathname.endsWith('/me')) return
  void signOut().then(() => router.navigate({ to: '/login', search: { reason: 'expired' } }))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
