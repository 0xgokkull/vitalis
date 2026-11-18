import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSessionEmail, SESSION_COOKIE } from '@/lib/session';

// Revokes this app's access at Google and deletes the stored tokens.
export async function POST() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: 'signed_out' }, { status: 401 });

  const db = getServiceSupabase();
  const { data } = await db.from('fitbit_tokens').select('refresh_token').eq('user_email', email).maybeSingle();
  if (data?.refresh_token) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: data.refresh_token }),
    }).catch(() => {});
  }
  const { error } = await db.from('fitbit_tokens').delete().eq('user_email', email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
