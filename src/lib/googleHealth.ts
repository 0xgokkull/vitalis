// Google Health API (v4) + Google OAuth helpers. Server-only.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
export const HEALTH_API = 'https://health.googleapis.com/v4';

// Read-only access the dashboard needs. All four must be granted.
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.settings.readonly', // paired devices (battery), time zone, units
];
// 'profile' only gives the display name shown in the top bar; it's optional, unlike the health scopes.
export const SCOPES = ['openid', 'email', 'profile', ...HEALTH_SCOPES];

export function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/auth/callback/google`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // get a refresh token
    prompt: 'consent', // always re-issue the refresh token
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error} ${json.error_description ?? ''}`);
  return json;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });

export const refreshAccessToken = (refresh_token: string) =>
  tokenRequest({ refresh_token, grant_type: 'refresh_token' });

// Verified email plus the Google display name (absent if the profile box was unticked).
export async function getUser(accessToken: string): Promise<{ email: string; name: string | null } | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.email_verified || typeof json.email !== 'string') return null;
  const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim().slice(0, 80) : null;
  return { email: json.email, name };
}
