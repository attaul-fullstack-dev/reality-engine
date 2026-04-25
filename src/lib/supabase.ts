import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Supabase client. When env vars are missing we still construct a client
 * pointing at a placeholder so type-level usage compiles, but every call
 * will fail at runtime with a clear error. UI code should branch on
 * `isSupabaseConfigured` and surface a setup banner instead of crashing.
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-not-configured',
)
