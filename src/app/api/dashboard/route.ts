import { connection, NextRequest, NextResponse } from 'next/server';
import { asUser, getDashboard } from '@/lib/healthData';
import { getSessionUser, SESSION_COOKIE } from '@/lib/session';

// Dashboard data for the signed-in user only.
export async function GET(req: NextRequest) {
  await connection();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'signed_out' }, { status: 401 });
  try {
    const date = req.nextUrl.searchParams.get('date') ?? undefined;
    const data = await asUser(user.email, () => getDashboard(date));
    return NextResponse.json({ ...data, account: user }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'not_connected' || msg === 'needs_reauth') {
      // Their Google connection is gone: end the session so they land on the start page.
      const res = NextResponse.json({ error: msg }, { status: 401 });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
