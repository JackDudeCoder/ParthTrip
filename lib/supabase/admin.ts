import { createClient } from '@supabase/supabase-js';

/**
 * Creates a privileged Supabase client for Server-only operations using the Service Role Key.
 * Bypasses Row Level Security (RLS) and enables Auth Admin capabilities (e.g., user invites).
 * NEVER expose or import this file into Client Components ('use client').
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
