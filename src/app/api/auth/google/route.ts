import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/googleHealth';
import { sessionSecretOk } from '@/lib/session';

// Starts "Continue with Google". Google sends the user back to /api/auth/callback/google.
export async function GET(req: Request) {
  // Without a proper session secret sign-in can't finish, so don't send people to Google first.
  if (!sessionSecretOk()) {
    console.error('[auth] No session key: set NEXTAUTH_SECRET (openssl rand -base64 32) or the Google and Supabase secrets.');
    return NextResponse.redirect(new URL('/?auth=setup', req.url));
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
    maxAge: 600,
    path: '/',
  });
  return res;
}
