import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// Sign-in only (D-11). Never call supabase.from(...): business data goes through the API.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'billing-auth',
  },
})

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
