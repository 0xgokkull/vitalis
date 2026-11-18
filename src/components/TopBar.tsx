'use client';

import { useEffect, useState } from 'react';
import type { DashboardData } from '../types/dashboard';
import { ago } from '../lib/format';
import { ThemeSwitch } from './ThemeSwitch';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';

interface Props {
  data: DashboardData | null;
  loading: boolean;
  onRefresh: () => void;
}

function Battery({ level }: { level?: number }) {
  const w = level != null ? Math.max(1.5, (level / 100) * 13) : 6;
  return (
    <svg viewBox="0 0 20 10" className="w-5 h-2.5 shrink-0" aria-hidden>
      <rect x="0.75" y="0.75" width="16" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="18" y="3.25" width="1.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="2.25" y="2.25" width={w} height="5.5" rx="1" fill={level != null && level < 20 ? 'var(--heart)' : 'var(--move)'} />
    </svg>
  );
}

export function TopBar({ data, loading, onRefresh }: Props) {
  const dev = data?.device;
  // Re-render every minute so "synced 4 min ago" stays true.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const synced = dev?.lastSyncTime && now ? ago(dev.lastSyncTime, now) : null;
  const stale = dev?.lastSyncTime && now ? now - Date.parse(dev.lastSyncTime) > 6 * 3600_000 : false;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 py-3 sm:py-4 before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2 before:w-screen before:-z-10 before:bg-bg/75 before:backdrop-blur-xl before:[mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
      <div className="flex items-center gap-3 min-w-0">
        <Logo size={36} />
        <div className="leading-tight min-w-0">
          <p className="font-display text-lg font-bold tracking-[-0.03em] text-ink">vitalis</p>
          <p className="text-[13px] text-muted flex items-center gap-2 whitespace-nowrap overflow-hidden">
            {data?.errors.device === 'needs_reauth' ? (
              <a href="/api/auth/google" className="underline underline-offset-2">Reconnect to see battery</a>
            ) : dev ? (
              <>
                <span className="hidden sm:inline">{dev.name}</span>
                <Battery level={dev.batteryLevel} />
                <span className="truncate">
                  {dev.batteryLevel != null ? `${dev.batteryLevel}%` : dev.batteryStatus}
                  {synced && (
                    <>
                      , <span className={stale ? 'text-awake' : undefined} title={stale ? 'Open the Fitbit app on your phone to sync the band' : undefined}>synced {synced}</span>
                    </>
                  )}
                </span>
              </>
            ) : (
              'Connecting…'
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh data"
          title="Refresh data"
          className="w-10 h-10 rounded-full bg-surface grid place-items-center text-ink-2 hover:text-ink disabled:opacity-60 transition-colors"
        >
          <svg viewBox="0 0 16 16" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ThemeSwitch />
        {data?.account && <AccountMenu email={data.account.email} />}
      </div>
    </header>
  );
}
