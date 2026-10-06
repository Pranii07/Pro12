// ===========================================================
// NeuroScreen — Supabase Client
// ===========================================================
// Initializes the Supabase client for browser usage.
// Uses VITE_ prefixed env vars (exposed to the frontend by Vite).
//
// IMPORTANT: Only the anon key is used here. The service-role key
// must NEVER appear in frontend code.
// ===========================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[NeuroScreen] Missing Supabase environment variables. ' +
    'Auth and database features will not work. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // Explicitly persist session in browser localStorage
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      // Auto-refresh token before expiry
      autoRefreshToken: true,
      // Detect session from URL (e.g., after OAuth redirect)
      detectSessionInUrl: true,
      // Storage key for session
      storageKey: 'neuroscreen-auth',
    },
  }
)
