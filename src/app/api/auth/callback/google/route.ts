import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, getEmail, HEALTH_SCOPES } from '@/lib/googleHealth';
import { getServiceSupabase } from '@/lib/supabase';
import { getSessionEmail, SESSION_COOKIE, sessionCookieOptions, sessionValue } from '@/lib/session';

// Google sends the user here after the consent screen. Every outcome goes back to
// the app: the dashboard on success, or the start page with a reason it didn't work.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const home = (reason?: string) => {
    const res = NextResponse.redirect(new URL(reason ? `/?auth=${reason}` : '/', url.origin));
    res.cookies.delete('oauth_state');
    return res;
  };

  if (url.searchParams.get('error')) return home(url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed');

  const state = url.searchParams.get('state');
  if (!state || state !== req.cookies.get('oauth_state')?.value) {
    // Usually this page was reloaded or opened twice. Already signed in? Just carry on.
    return home((await getSessionEmail()) ? undefined : 'expired');
  }

  try {
    const tokens = await exchangeCode(url.searchParams.get('code') ?? '');

    // Google lets people untick boxes on the consent screen; the dashboard needs all of them.
    const granted = new Set(tokens.scope.split(' '));
    if (HEALTH_SCOPES.some((s) => !granted.has(s))) return home('scopes');

    const email = await getEmail(tokens.access_token);
    if (!email) return home('failed');
    const allow = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes(email.toLowerCase())) return home('not_allowed');
    if (!tokens.refresh_token) return home('failed');

    const { error } = await getServiceSupabase()
      .from('fitbit_tokens')
      .upsert(
        {
          user_email: email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: [...granted],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      );
    if (error) {
      console.error('[auth] storing tokens failed:', error.message);
      return home('failed');
    }

    const res = home();
    res.cookies.set(SESSION_COOKIE, sessionValue(email), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error('[auth] callback failed:', (e as Error).message);
    return home('failed');
  }
}
