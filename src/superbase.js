import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public-anon-key'

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function logAccess(user) {
  if (!isSupabaseConfigured) return
  try {
    await supabase.from('access_logs').insert({
      user_id: user.id,
      email: user.email,
      role: user.user_metadata?.role,
      device: navigator.userAgent,
      ip_address: 'web-client',
    })
  } catch {
    // Ignore logging failures when Supabase is not configured.
  }
}
