import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
    // Never retry writes automatically; the Idempotency-Key retry is explicit (decisions.md D-08).
    mutations: { retry: false },
  },
})
