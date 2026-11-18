import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// Signs out of this browser. The Google connection stays, so signing in again is one click.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
