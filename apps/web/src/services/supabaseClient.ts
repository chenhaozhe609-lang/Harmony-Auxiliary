import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase is configured through Vite env vars. When they are absent (local dev
// without secrets, CI), the client is `null` and the app falls back to its
// "not configured" path instead of throwing. Only the public anon key is used
// here; access control is enforced server-side by row-level security.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the configured client or throws a typed error. Use at call sites that
 * already gate on {@link isSupabaseConfigured} so the thrown case is unreachable
 * in practice but keeps types honest.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}
