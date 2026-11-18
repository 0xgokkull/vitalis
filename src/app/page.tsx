import { Suspense } from 'react';
import { getSessionEmail } from '@/lib/session';
import { Dashboard } from '@/components/Dashboard';
import { Landing } from '@/components/Landing';

// Signed in: the dashboard. Otherwise: the start page with "Continue with Google".
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={null}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [email, sp] = await Promise.all([getSessionEmail(), searchParams]);
  if (email) return <Dashboard />;
  const auth = typeof sp.auth === 'string' ? sp.auth : undefined;
  return <Landing notice={auth} />;
}
