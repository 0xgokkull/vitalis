// Server-only: a signed session cookie that says which Google account is signed in.
// Format: base64url(JSON {e: email, n: display name, x: expiry ms}) + "." + HMAC-SHA256 signature.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

export const SESSION_COOKIE = 'session';
const MAX_AGE = 30 * 24 * 3600; // seconds

// The key that signs sessions. NEXTAUTH_SECRET wins when it's a real random value.
// Otherwise derive one from secrets the server already has, so a fresh install needs
// no extra setup. Never fall back to anything public or guessable.
function secret(): string | null {
  const own = process.env.NEXTAUTH_SECRET;
  if (own && own.length >= 32 && !/generate|change|example|your-|secret/i.test(own)) return own;
  const a = process.env.GOOGLE_CLIENT_SECRET;
  const b = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!a || !b) return null;
  return createHmac('sha256', `${a}:${b}`).update('vitalis session key v1').digest('base64url');
}

/** False only when the server has no secret material to sign sessions with. */
export function sessionSecretOk(): boolean {
  return secret() != null;
}

function key(): string {
  const k = secret();
  if (!k) throw new Error('No session key: set NEXTAUTH_SECRET, or GOOGLE_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY');
  return k;
}

const sign = (data: string) => createHmac('sha256', key()).update(data).digest('base64url');

export function sessionValue(email: string, name: string | null = null): string {
  const data = Buffer.from(JSON.stringify({ e: email, n: name, x: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readSession(value: string | undefined): { email: string; name: string | null } | null {
  if (!value) return null;
  const [data, sig] = value.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, n, x } = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (typeof e !== 'string' || typeof x !== 'number' || x <= Date.now()) return null;
    return { email: e, name: typeof n === 'string' ? n : null }; // sessions from before names have no n
  } catch {
    return null;
  }
}

/** The signed-in user (email and Google display name), or null. */
export async function getSessionUser(): Promise<{ email: string; name: string | null } | null> {
  await connection(); // per request, never prerendered
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Email of the signed-in user, or null. */
export async function getSessionEmail(): Promise<string | null> {
  return (await getSessionUser())?.email ?? null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
  path: '/',
  maxAge: MAX_AGE,
};
