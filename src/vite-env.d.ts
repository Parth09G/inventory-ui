/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' in demo mode (mock API in the browser). */
  readonly VITE_DEMO?: string
}
