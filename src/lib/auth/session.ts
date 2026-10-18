import { queryClient } from '@/app/query-client'
import { supabase } from './supabase'

/** Signs out of Supabase and drops every cached API response. */
export async function signOut() {
  await supabase.auth.signOut()
  queryClient.clear()
}
