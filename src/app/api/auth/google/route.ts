import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/googleHealth';

// Starts "Continue with Google". Google sends the user back to /api/auth/callback/google.
export async function GET() {
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
