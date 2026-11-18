// Server-only: a signed session cookie that says which Google account is signed in.
// Format: base64url(JSON {e: email, x: expiry ms}) + "." + HMAC-SHA256 signature.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

export const SESSION_COOKIE = 'session';
const MAX_AGE = 30 * 24 * 3600; // seconds

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  // A guessable secret would let anyone forge a session, so refuse short or example values.
  if (!s || s.length < 32 || /generate|change|example|your-|secret/i.test(s)) {
    throw new Error('NEXTAUTH_SECRET must be a random value of 32+ characters (run: openssl rand -base64 32)');
  }
  return s;
}

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function sessionValue(email: string): string {
  const data = Buffer.from(JSON.stringify({ e: email, x: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readSession(value: string | undefined): string | null {
  if (!value) return null;
  const [data, sig] = value.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(data, 'base64url').toString());
    return typeof e === 'string' && typeof x === 'number' && x > Date.now() ? e : null;
  } catch {
    return null;
  }
}

/** Email of the signed-in user, or null. */
export async function getSessionEmail(): Promise<string | null> {
  await connection(); // per request, never prerendered
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
  path: '/',
  maxAge: MAX_AGE,
};
