import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Route handler for Supabase PKCE and magic link authentication callbacks.
 * Handles employee invite links, magic links, email confirmations, and recovery links.
 * Reads profile role to dynamically redirect to the correct dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  const supabase = await createClient();

  // 1. PKCE Code Exchange
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return handleRedirect(supabase, data.user.id, next, origin, request);
    }
    console.error('[Auth Callback] Code exchange error:', error?.message);
  }
  
  // 2. Token Hash / OTP verification
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error && data.user) {
      return handleRedirect(supabase, data.user.id, next, origin, request);
    }
    console.error('[Auth Callback] Token verification error:', error?.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

async function handleRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  next: string | null,
  origin: string,
  request: Request
) {
  let destination = next;

  if (!destination) {
    // Query role from public.profiles to determine the correct portal
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    destination = profile?.role === 'admin' ? '/admin' : '/employee/dashboard';
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${destination}`);
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${destination}`);
  } else {
    return NextResponse.redirect(`${origin}${destination}`);
  }
}
